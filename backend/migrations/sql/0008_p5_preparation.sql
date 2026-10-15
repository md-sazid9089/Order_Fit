-- Additive P5 evidence; no approval/execution privileges or workflow enabled.
ALTER TABLE deal ADD COLUMN analysis_changes jsonb NOT NULL DEFAULT '[]'
 CHECK(jsonb_typeof(analysis_changes)='array' AND jsonb_array_length(analysis_changes)<=10);
ALTER TABLE whatif_run ADD COLUMN operation_id uuid,
 ADD CONSTRAINT whatif_scope_unique UNIQUE(business_id,deal_id,id),
 ADD CONSTRAINT whatif_operation_unique UNIQUE(operation_id),
 ADD CONSTRAINT whatif_snapshot_fk FOREIGN KEY(business_id,deal_id,snapshot_id)
 REFERENCES input_snapshot(business_id,deal_id,id),
 ADD CONSTRAINT whatif_operation_fk FOREIGN KEY(business_id,operation_id) REFERENCES operation(business_id,id);

-- Existing messages remain the text/evidence owner. One new immutable row per revision.
CREATE TABLE prepared_message (
 business_id uuid NOT NULL, deal_id uuid NOT NULL, id uuid PRIMARY KEY,
 evaluation_id uuid NOT NULL, option_key text NOT NULL,
 previous_id uuid, payload jsonb NOT NULL, content_hash bytea NOT NULL CHECK(octet_length(content_hash)=32),
 UNIQUE(business_id,deal_id,id), UNIQUE(previous_id),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 FOREIGN KEY(business_id,id) REFERENCES negotiation_message(business_id,id),
 FOREIGN KEY(business_id,deal_id,evaluation_id) REFERENCES evaluation(business_id,deal_id,id),
 FOREIGN KEY(business_id,evaluation_id,option_key) REFERENCES evaluation_option(business_id,evaluation_id,option_key),
 FOREIGN KEY(business_id,deal_id,previous_id) REFERENCES prepared_message(business_id,deal_id,id)
);
CREATE INDEX prepared_message_scope_idx ON prepared_message(business_id,deal_id);
CREATE TABLE preparation_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, deal_id uuid NOT NULL,
 message_id uuid NOT NULL UNIQUE, preparation_hash bytea NOT NULL CHECK(octet_length(preparation_hash)=32),
 recorded_by uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), attestation text NOT NULL,
 FOREIGN KEY(business_id,deal_id,message_id) REFERENCES prepared_message(business_id,deal_id,id),
 FOREIGN KEY(recorded_by,business_id) REFERENCES membership(user_id,business_id)
);
CREATE TABLE reply_candidate_set (
 business_id uuid NOT NULL, deal_id uuid NOT NULL, id uuid PRIMARY KEY,
 ask_message_id uuid NOT NULL, payload jsonb NOT NULL, operation_id uuid NOT NULL UNIQUE,
 UNIQUE(business_id,deal_id,id),
 FOREIGN KEY(business_id,id) REFERENCES negotiation_message(business_id,id),
 FOREIGN KEY(business_id,deal_id,ask_message_id) REFERENCES prepared_message(business_id,deal_id,id),
 FOREIGN KEY(business_id,operation_id) REFERENCES operation(business_id,id)
);
CREATE INDEX reply_candidate_scope_idx ON reply_candidate_set(business_id,deal_id);
CREATE TABLE reply_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, deal_id uuid NOT NULL,
 reply_id uuid NOT NULL UNIQUE, payload jsonb NOT NULL, recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(business_id,deal_id,reply_id) REFERENCES reply_candidate_set(business_id,deal_id,id),
 FOREIGN KEY(recorded_by,business_id) REFERENCES membership(user_id,business_id)
);
CREATE TABLE party_acceptance (
 id uuid PRIMARY KEY, business_id uuid NOT NULL, deal_id uuid NOT NULL, message_id uuid NOT NULL,
 reply_id uuid, supersedes_id uuid UNIQUE, payload jsonb NOT NULL,
 UNIQUE(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id,message_id) REFERENCES prepared_message(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id,reply_id) REFERENCES reply_candidate_set(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id,supersedes_id) REFERENCES party_acceptance(business_id,deal_id,id)
);
CREATE INDEX party_acceptance_scope_idx ON party_acceptance(business_id,deal_id);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['prepared_message','preparation_review','reply_candidate_set','reply_review','party_acceptance'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id=(SELECT app_business_id())) WITH CHECK (business_id=(SELECT app_business_id()))',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO orderfit_app',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_change()',t);
 END LOOP;
END $$;
CREATE TRIGGER p5_whatif_immutable BEFORE UPDATE OR DELETE ON whatif_run
 FOR EACH ROW EXECUTE FUNCTION forbid_change();
-- P5 preparation text is immutable, even while its legacy message status is draft.
CREATE FUNCTION p5_message_frozen() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.prepared_message WHERE id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.reply_candidate_set WHERE id=OLD.id) THEN
  RAISE EXCEPTION 'immutable preparation' USING ERRCODE='OF010';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER p5_message_frozen BEFORE UPDATE OR DELETE ON negotiation_message
 FOR EACH ROW EXECUTE FUNCTION p5_message_frozen();
-- P5 deliberately has no bank-verification resolution flow. Never accept generic override.
CREATE FUNCTION p5_bank_blocker() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF OLD.code='P5-BANK-CHANGE' AND (NEW.resolved_at IS NOT NULL OR NOT NEW.blocking
   OR NEW.code IS DISTINCT FROM OLD.code OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
   OR NEW.business_id IS DISTINCT FROM OLD.business_id) THEN
  RAISE EXCEPTION 'bank verification required' USING ERRCODE='OF002';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p5_bank_blocker BEFORE UPDATE ON deal_flag
 FOR EACH ROW EXECUTE FUNCTION p5_bank_blocker();
