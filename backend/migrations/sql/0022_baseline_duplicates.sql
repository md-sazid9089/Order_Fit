-- No financial rows are removed or merged. Claims survive voiding/correction.
-- Identity is scoped to an immutable file version (SHA-256) and its physical CSV row.
CREATE TABLE cash_event_source_claim (
 business_id uuid NOT NULL,
 content_hash bytea NOT NULL CHECK(octet_length(content_hash)=32),
 source_row integer NOT NULL CHECK(source_row BETWEEN 2 AND 2001),
 cash_event_id bigint NOT NULL,
 PRIMARY KEY(business_id,content_hash,source_row),
 FOREIGN KEY(business_id,cash_event_id) REFERENCES cash_event(business_id,id)
);
-- Backfill only rows attributable to a confirmed CSV preview. If history already
-- contains repeated imports, reserve the source against its earliest existing row;
-- preserve ALL rows for human reconciliation via the review API.
INSERT INTO cash_event_source_claim(business_id,content_hash,source_row,cash_event_id)
SELECT p.business_id,d.content_hash,(e.value->>'row')::integer,min(ce.id)
FROM csv_confirmation cf
JOIN csv_preview p ON p.business_id=cf.business_id AND p.id=cf.preview_id
JOIN document d ON d.business_id=p.business_id AND d.id=p.document_id
CROSS JOIN LATERAL jsonb_array_elements(p.events) e(value)
JOIN cash_event ce ON ce.business_id=p.business_id AND ce.source_document_id=p.document_id
 AND ce.source_quote='row '||(e.value->>'row') AND ce.deal_id IS NULL
WHERE (e.value->>'row') ~ '^[0-9]{1,4}$'
 AND (e.value->>'row')::integer BETWEEN 2 AND 2001
GROUP BY p.business_id,d.content_hash,(e.value->>'row')::integer;

CREATE TABLE cash_event_duplicate_review (
 business_id uuid NOT NULL,
 event_id bigint NOT NULL,
 event_version integer NOT NULL CHECK(event_version>0),
 matching_event_id bigint NOT NULL,
 matching_event_version integer NOT NULL CHECK(matching_event_version>0),
 reviewed_by uuid NOT NULL REFERENCES app_user(id),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 12 AND 2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(event_id<matching_event_id),
 PRIMARY KEY(business_id,event_id,event_version,matching_event_id,matching_event_version),
 FOREIGN KEY(business_id,event_id) REFERENCES cash_event(business_id,id),
 FOREIGN KEY(business_id,matching_event_id) REFERENCES cash_event(business_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cash_event_source_claim','cash_event_duplicate_review'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id=(SELECT app_business_id())) WITH CHECK (business_id=(SELECT app_business_id()))',t);
  EXECUTE format('CREATE POLICY platform_admin ON %I TO orderfit_admin USING(true) WITH CHECK(true)',t);
  -- Default privileges may include broader writes: history is insert-only.
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,orderfit_app,orderfit_readonly',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO orderfit_app',t);
  EXECUTE format('GRANT SELECT ON %I TO orderfit_readonly',t);
  EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION p4_immutable()',t);
 END LOOP;
END $$;
-- A review changes financial-input eligibility, so outstanding snapshots become stale.
CREATE FUNCTION baseline_review_revision() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.reviewed_by IS DISTINCT FROM public.app_user_id() THEN
  RAISE EXCEPTION 'review actor mismatch' USING ERRCODE='OF003'; END IF;
 UPDATE public.business SET financial_revision=financial_revision+1 WHERE id=NEW.business_id;
 RETURN NEW;
END $$;
CREATE TRIGGER baseline_review_revision AFTER INSERT ON cash_event_duplicate_review
FOR EACH ROW EXECUTE FUNCTION baseline_review_revision();

CREATE FUNCTION baseline_invoice_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT lower(regexp_replace(btrim(coalesce(value,'')), '\s+', ' ', 'g'))
$$;
CREATE INDEX cash_event_duplicate_date_idx ON cash_event(business_id,direction,kind,event_date,amount_minor)
 WHERE voided_at IS NULL;
CREATE INDEX cash_event_duplicate_invoice_idx ON cash_event(business_id,direction,kind,baseline_invoice_key(invoice_ref))
 WHERE voided_at IS NULL AND baseline_invoice_key(invoice_ref)<>'';
CREATE INDEX csv_preview_source_idx ON csv_preview(business_id,document_id);

-- Existing confirmed snapshots must not bypass the new canonical review gate.
-- Invalidate once per business with live baseline/projection data, without
-- rewriting cash events or deleting immutable evaluations. The temporary trigger
-- supplies the same nested-update semantics as the existing revision triggers.
CREATE TEMP TABLE baseline_duplicate_cutover(business_id uuid PRIMARY KEY) ON COMMIT DROP;
CREATE FUNCTION pg_temp.baseline_duplicate_cutover() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 UPDATE public.business SET financial_revision=financial_revision+1 WHERE id=NEW.business_id;
 INSERT INTO public.operation_log(business_id,actor,action,outcome,payload)
 VALUES(NEW.business_id,'system','baseline_duplicate_policy_cutover','completed',
        '{"schema_revision":"0022_baseline_duplicates"}'::jsonb);
 RETURN NEW;
END $$;
CREATE TRIGGER baseline_duplicate_cutover AFTER INSERT ON baseline_duplicate_cutover
FOR EACH ROW EXECUTE FUNCTION pg_temp.baseline_duplicate_cutover();
INSERT INTO baseline_duplicate_cutover(business_id)
SELECT DISTINCT ce.business_id FROM cash_event ce WHERE ce.voided_at IS NULL
 AND (ce.deal_id IS NULL OR EXISTS(SELECT FROM commitment_projection cp
      WHERE cp.business_id=ce.business_id AND cp.cash_event_id=ce.id));
