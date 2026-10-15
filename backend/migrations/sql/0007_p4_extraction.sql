-- P4: immutable parse/extraction evidence. extracted_field stays the current reviewed projection.
-- Typed job parameters (e.g. CSV as_of/currency) are fixed at admission and covered by the request hash.
ALTER TABLE operation ADD COLUMN parameters jsonb CHECK(parameters IS NULL OR jsonb_typeof(parameters)='object');

CREATE TABLE document_parse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  document_id uuid NOT NULL,
  parser text NOT NULL CHECK (parser IN ('pdf_text','plain_text','csv','json')),
  parser_version text NOT NULL CHECK (length(parser_version) BETWEEN 1 AND 64),
  status text NOT NULL CHECK (status IN ('parsed','failed','ocr_required')),
  error_code text CHECK (length(error_code) <= 64),
  pages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pages)='array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id,id),
  UNIQUE(business_id,deal_id,document_id,id),
  FOREIGN KEY(business_id,deal_id,document_id) REFERENCES document(business_id,deal_id,id)
);
CREATE INDEX document_parse_document_idx ON document_parse(document_id,created_at DESC);

CREATE TABLE extraction_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  document_id uuid NOT NULL,
  parse_id uuid NOT NULL,
  operation_id uuid,
  llm_mode text NOT NULL CHECK (llm_mode IN ('off','recorded','live')),
  model text CHECK (length(model) <= 128),
  prompt_name text NOT NULL,
  prompt_hash bytea CHECK (octet_length(prompt_hash)=32),
  schema_name text NOT NULL,
  input_hash bytea NOT NULL CHECK (octet_length(input_hash)=32),
  status text NOT NULL CHECK (status IN ('completed','unavailable','failed')),
  error_code text CHECK (length(error_code) <= 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id,id),
  FOREIGN KEY(business_id,deal_id,document_id,parse_id) REFERENCES document_parse(business_id,deal_id,document_id,id)
);

CREATE TABLE extraction_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  document_id uuid NOT NULL,
  run_id uuid NOT NULL,
  field text NOT NULL CHECK (field ~ '^[a-z][a-z0-9_.]{0,63}$'),
  value jsonb NOT NULL,
  source_page integer CHECK (source_page >= 1),
  source_quote text CHECK (length(source_quote) <= 2000),
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL CHECK (status IN ('extracted','ambiguous','missing','conflicting')),
  source_role text CHECK (source_role IN ('customer_order','customer_sales_quote','supplier_cost_quote','baseline','financing','owner_constraints','reply','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id,id),
  FOREIGN KEY(business_id,run_id) REFERENCES extraction_run(business_id,id),
  FOREIGN KEY(business_id,deal_id,document_id) REFERENCES document(business_id,deal_id,id),
  CHECK (value <> 'null'::jsonb OR status = 'missing')
);
CREATE INDEX extraction_candidate_field_idx ON extraction_candidate(deal_id,field,id DESC);
ALTER TABLE extracted_field ADD COLUMN candidate_id uuid,
  ADD COLUMN resolution_reason text CHECK (length(resolution_reason) <= 1000),
  ADD FOREIGN KEY(business_id,candidate_id) REFERENCES extraction_candidate(business_id,id);

CREATE TABLE csv_preview (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  document_id uuid NOT NULL,
  financial_revision bigint NOT NULL CHECK (financial_revision > 0),
  currency text NOT NULL CHECK (currency IN ('BDT','USD','EUR','GBP')),
  as_of biz_date NOT NULL,
  events jsonb NOT NULL CHECK (jsonb_typeof(events)='array' AND jsonb_array_length(events) <= 2000),
  errors jsonb NOT NULL CHECK (jsonb_typeof(errors)='array'),
  duplicate_keys jsonb NOT NULL CHECK (jsonb_typeof(duplicate_keys)='array'),
  preview_hash bytea NOT NULL CHECK (octet_length(preview_hash)=32),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id,id),
  FOREIGN KEY(business_id,deal_id,document_id) REFERENCES document(business_id,deal_id,id)
);
CREATE TABLE csv_confirmation (
  preview_id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  confirmed_by uuid NOT NULL REFERENCES app_user(id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(business_id,preview_id) REFERENCES csv_preview(business_id,id)
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['document_parse','extraction_run','extraction_candidate','csv_preview','csv_confirmation'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id=(SELECT app_business_id())) WITH CHECK (business_id=(SELECT app_business_id()))',t);
  EXECUTE format('CREATE POLICY platform_admin ON %I TO orderfit_admin USING(true) WITH CHECK(true)',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO orderfit_app',t);
  EXECUTE format('GRANT SELECT ON %I TO orderfit_readonly',t);
 END LOOP;
END $$;
-- Immutable history: no UPDATE/DELETE grants; block owner-side rewrites too.
CREATE FUNCTION p4_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 RAISE EXCEPTION 'immutable P4 evidence' USING ERRCODE='OF010'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['document_parse','extraction_run','extraction_candidate','csv_preview','csv_confirmation'] LOOP
  EXECUTE format('CREATE TRIGGER p4_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION p4_immutable()',t);
 END LOOP;
END $$;
-- extracted_field projection: app may set the reviewed columns.
GRANT UPDATE(status,confirmed_value,confirmed_by,confirmed_at,candidate_id,resolution_reason,value,source_page,source_quote,confidence) ON extracted_field TO orderfit_app;

-- Extraction itself writes revision-bearing source rows (extracted_field), so finish must not
-- treat its own writes as staleness; run_extract checks freshness under the deal lock before writing.
CREATE OR REPLACE FUNCTION operation_finish(p_id uuid,p_token uuid,p_result jsonb,p_retry boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job public.operation; b public.business; d public.deal; oldb text; oldu text; BEGIN
 SELECT * INTO job FROM public.operation WHERE id=p_id;
 IF NOT FOUND THEN RETURN false; END IF;
 -- Global owner lookup only establishes scope; actual locks use business/deal/job order.
 oldb:=current_setting('app.business_id',true); oldu:=current_setting('app.user_id',true);
 PERFORM set_config('app.business_id',job.business_id::text,true),set_config('app.user_id',job.actor_user_id::text,true);
 SELECT * INTO b FROM public.business WHERE id=job.business_id FOR UPDATE;
 IF job.deal_id IS NOT NULL THEN SELECT * INTO d FROM public.deal WHERE id=job.deal_id FOR UPDATE; END IF;
 SELECT * INTO job FROM public.operation WHERE id=p_id FOR UPDATE;
 IF job.lease_token IS DISTINCT FROM p_token OR job.status<>'running' OR job.lease_expires_at<=clock_timestamp() THEN
  PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true); RETURN false;
 END IF;
 IF job.cancellation_requested THEN
  UPDATE public.operation SET status='cancelled',subphase='cancelled',lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSIF NOT EXISTS(SELECT FROM public.operation_context(p_id,p_token)) THEN
  UPDATE public.operation SET status='failed',subphase='authorization_revoked',result=jsonb_build_object('kind','failed','error',jsonb_build_object('code','AUTHORIZATION_REVOKED','message','The operation could not be completed.','request_id',gen_random_uuid(),'details','{}'::jsonb,'retryable',false)),lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSIF job.kind<>'extract' AND (b.financial_revision<>job.financial_revision OR (job.deal_id IS NOT NULL AND d.input_version<>job.input_version)) THEN
  UPDATE public.operation SET status='succeeded',subphase='stale',result='{"kind":"blocked","outcome":"stale","findings":[{"code":"STALE_INPUT_VERSION","field":null,"message":"Inputs changed. Refresh before continuing.","blocking":true,"resolution":"refresh"}]}',lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSIF p_retry AND job.attempt<3 THEN
  UPDATE public.operation SET status='queued',subphase='retry_wait',available_at=clock_timestamp()+make_interval(secs=>power(2,job.attempt)::int),lease_token=NULL,lease_expires_at=NULL,version=version+1 WHERE id=p_id;
 ELSE
  UPDATE public.operation SET status=CASE WHEN p_result->>'kind'='failed' THEN 'failed' ELSE 'succeeded' END,
   subphase='finished',result=p_result,lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 END IF;
 IF job.kind='evaluate' AND d.status='computing' THEN
  IF job.cancellation_requested OR b.financial_revision<>job.financial_revision OR d.input_version<>job.input_version OR p_result->>'kind'='blocked' THEN
   UPDATE public.deal SET status='awaiting_confirm' WHERE id=job.deal_id;
  ELSIF NOT EXISTS(SELECT FROM public.operation_context(p_id,p_token)) AND EXISTS(SELECT FROM public.operation WHERE id=p_id AND status='failed') THEN
   UPDATE public.deal SET status='failed' WHERE id=job.deal_id;
  END IF;
 END IF;
 INSERT INTO public.operation_log(business_id,deal_id,actor,actor_user_id,action,outcome,payload)
 VALUES(job.business_id,job.deal_id,'system',job.actor_user_id,'operation_finish','completed',jsonb_build_object('operation_id',p_id));
 PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION operation_finish(uuid,uuid,jsonb,boolean) FROM PUBLIC;
