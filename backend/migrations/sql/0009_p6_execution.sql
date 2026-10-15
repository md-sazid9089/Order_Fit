-- P6: exact immutable action manifests and locally simulated effects only.
-- Existing approvals/actions remain valid; new commands must reference a bundle.
ALTER TABLE negotiation_message ADD CONSTRAINT negotiation_message_deal_id_uq UNIQUE(business_id,deal_id,id);
ALTER TABLE payee_bank_account ADD CONSTRAINT payee_bank_account_business_id_uq UNIQUE(business_id,id);
CREATE TABLE action_bundle (
 business_id uuid NOT NULL, deal_id uuid NOT NULL, id uuid NOT NULL,
 evaluation_id uuid NOT NULL, option_key text NOT NULL, snapshot_id uuid NOT NULL,
 input_version bigint NOT NULL, financial_revision bigint NOT NULL,
 action text NOT NULL CHECK(action IN ('send_message','commit_plan','compensate')),
 manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
 canonical_manifest bytea NOT NULL, bundle_hash bytea NOT NULL CHECK(octet_length(bundle_hash)=32),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL, sandbox boolean NOT NULL DEFAULT true CHECK(sandbox),
 PRIMARY KEY(id), UNIQUE(business_id,deal_id,id), UNIQUE(business_id,id),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 FOREIGN KEY(business_id,deal_id,evaluation_id) REFERENCES evaluation(business_id,deal_id,id),
 FOREIGN KEY(business_id,evaluation_id,option_key) REFERENCES evaluation_option(business_id,evaluation_id,option_key),
 FOREIGN KEY(business_id,deal_id,snapshot_id) REFERENCES input_snapshot(business_id,deal_id,id),
 FOREIGN KEY(created_by,business_id) REFERENCES membership(user_id,business_id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours'),
 CHECK(sha256(canonical_manifest)=bundle_hash),
 CHECK(convert_from(canonical_manifest,'UTF8')::jsonb=manifest)
);
CREATE TABLE action_bundle_item (
 business_id uuid NOT NULL, deal_id uuid NOT NULL, bundle_id uuid NOT NULL,
 item_key text NOT NULL CHECK(length(item_key) BETWEEN 1 AND 120),
 kind text NOT NULL CHECK(kind IN ('message','ledger_entry','lender_acceptance','cancellation')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 item_hash bytea NOT NULL CHECK(octet_length(item_hash)=32),
 message_id uuid, party_id uuid, party_version bigint, terms_hash bytea,
 PRIMARY KEY(bundle_id,item_key), UNIQUE(business_id,deal_id,bundle_id,item_key),
 FOREIGN KEY(business_id,deal_id,bundle_id) REFERENCES action_bundle(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id,message_id) REFERENCES negotiation_message(business_id,deal_id,id),
 CHECK(sha256(convert_to(payload::text,'UTF8'))=item_hash),
 CHECK((kind='message')=(message_id IS NOT NULL)),
 CHECK((party_id IS NULL)=(party_version IS NULL)),
 CHECK(terms_hash IS NULL OR octet_length(terms_hash)=32)
);
CREATE INDEX action_bundle_deal_idx ON action_bundle(business_id,deal_id,created_at DESC);

ALTER TABLE approval ADD COLUMN bundle_id uuid;
ALTER TABLE approval ADD COLUMN step_up_grant_id uuid;
ALTER TABLE approval ADD CONSTRAINT approval_bundle_fk
 FOREIGN KEY(business_id,deal_id,bundle_id) REFERENCES action_bundle(business_id,deal_id,id);
ALTER TABLE approval ADD CONSTRAINT approval_step_up_fk FOREIGN KEY(step_up_grant_id) REFERENCES step_up_grant(id);
ALTER TABLE step_up_grant ADD CONSTRAINT step_up_bundle_fk
 FOREIGN KEY(business_id,bundle_id) REFERENCES action_bundle(business_id,id);
ALTER TABLE approval ADD CONSTRAINT approval_bundle_hash_shape CHECK(bundle_id IS NULL OR action_plan_hash IS NOT NULL);
CREATE TABLE approval_revocation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, deal_id uuid NOT NULL,
 approval_id uuid NOT NULL, actor_user_id uuid NOT NULL, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(approval_id),
 FOREIGN KEY(business_id,deal_id,approval_id) REFERENCES approval(business_id,deal_id,id),
 FOREIGN KEY(actor_user_id,business_id) REFERENCES membership(user_id,business_id)
);

CREATE TABLE execution_run (
 id uuid PRIMARY KEY, business_id uuid NOT NULL, deal_id uuid NOT NULL, bundle_id uuid NOT NULL,
 approval_id uuid NOT NULL, run_kind text NOT NULL CHECK(run_kind IN ('send_message','commit_plan','compensate')),
 status text NOT NULL CHECK(status IN ('queued','running','succeeded','partial','failed','cancelled')),
 operation_id uuid, idempotency_key text NOT NULL, fencing_token uuid NOT NULL,
 reconciliation_required boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), started_at timestamptz, finished_at timestamptz,
 UNIQUE(bundle_id), UNIQUE(business_id,id), UNIQUE(business_id,id,bundle_id), UNIQUE(business_id,idempotency_key),
 FOREIGN KEY(business_id,deal_id,bundle_id) REFERENCES action_bundle(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id,approval_id) REFERENCES approval(business_id,deal_id,id),
 FOREIGN KEY(business_id,operation_id) REFERENCES operation(business_id,id)
);
ALTER TABLE execution_action ADD COLUMN run_id uuid;
ALTER TABLE execution_action ADD COLUMN bundle_id uuid;
ALTER TABLE execution_action ADD COLUMN item_key text;
ALTER TABLE execution_action ADD CONSTRAINT execution_action_run_item_fk
 FOREIGN KEY(business_id,run_id,bundle_id)
 REFERENCES execution_run(business_id,id,bundle_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE execution_action ADD CONSTRAINT execution_action_manifest_item_fk
 FOREIGN KEY(business_id,deal_id,bundle_id,item_key)
 REFERENCES action_bundle_item(business_id,deal_id,bundle_id,item_key) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE execution_action ADD CONSTRAINT execution_action_deal_message_fk
 FOREIGN KEY(business_id,deal_id,message_id) REFERENCES negotiation_message(business_id,deal_id,id);
CREATE UNIQUE INDEX execution_action_run_item_uq ON execution_action(run_id,item_key) WHERE run_id IS NOT NULL;

CREATE TABLE commitment_gate (
 business_id uuid PRIMARY KEY REFERENCES business(id), run_id uuid NOT NULL UNIQUE,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(business_id,run_id) REFERENCES execution_run(business_id,id)
);
CREATE TABLE commitment_projection (
 business_id uuid NOT NULL, deal_id uuid NOT NULL, action_id uuid NOT NULL,
 cash_event_id bigint NOT NULL, original_obligation_id text NOT NULL,
 evaluation_id uuid NOT NULL, bundle_id uuid NOT NULL, projected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(action_id,cash_event_id), UNIQUE(business_id,cash_event_id),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 FOREIGN KEY(action_id) REFERENCES execution_action(id),
 FOREIGN KEY(business_id,deal_id,bundle_id) REFERENCES action_bundle(business_id,deal_id,id),
 FOREIGN KEY(business_id,deal_id,evaluation_id) REFERENCES evaluation(business_id,deal_id,id),
 FOREIGN KEY(business_id,cash_event_id) REFERENCES cash_event(business_id,id)
);
CREATE TABLE sandbox_effect (
 business_id uuid NOT NULL, action_id uuid NOT NULL, effect_kind text NOT NULL
 CHECK(effect_kind IN ('outbox','ledger','lender_simulation','inverse')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(action_id), FOREIGN KEY(action_id) REFERENCES execution_action(id),
 CHECK(sha256(convert_to(payload::text,'UTF8'))=payload_hash)
);

-- A bank-change hold can be resolved only against a verified account and explicit evidence.
CREATE TABLE bank_verification_resolution (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, deal_id uuid NOT NULL,
 flag_id bigint NOT NULL, source_reply_id uuid NOT NULL, account_id uuid NOT NULL, actor_user_id uuid NOT NULL,
 evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 12 AND 2000),
 verified_fingerprint bytea NOT NULL CHECK(octet_length(verified_fingerprint)=32),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(flag_id),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 FOREIGN KEY(business_id,deal_id,source_reply_id) REFERENCES reply_candidate_set(business_id,deal_id,id),
 FOREIGN KEY(business_id,account_id) REFERENCES payee_bank_account(business_id,id),
 FOREIGN KEY(actor_user_id,business_id) REFERENCES membership(user_id,business_id)
);

-- Bundle/item rows are immutable and tenant isolated. Existing rows are untouched.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['action_bundle','action_bundle_item','approval_revocation','execution_run',
  'commitment_projection','sandbox_effect','bank_verification_resolution'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id=(SELECT app_business_id())) WITH CHECK (business_id=(SELECT app_business_id()))',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO orderfit_app',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_change()',t);
 END LOOP;
END $$;
ALTER TABLE commitment_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_gate FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commitment_gate USING(business_id=(SELECT app_business_id())) WITH CHECK(business_id=(SELECT app_business_id()));
GRANT SELECT,INSERT,DELETE ON commitment_gate TO orderfit_app;
GRANT SELECT,INSERT ON action_bundle,action_bundle_item,approval_revocation,execution_run,
 commitment_projection,sandbox_effect,bank_verification_resolution TO orderfit_app;
GRANT SELECT,INSERT ON commitment_gate TO orderfit_app;
GRANT USAGE ON SCHEMA public TO orderfit_app;

-- Current authorization at each boundary. A rejected/legacy approval remains readable,
-- but only a bundle-bound approval can create a P6 run.
CREATE OR REPLACE FUNCTION approval_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tier text; b public.action_bundle; grant_row public.step_up_grant; current_deal public.deal; legacy_message record;
BEGIN
 IF NEW.bundle_id IS NULL THEN
  IF NOT EXISTS(SELECT FROM public.app_user u WHERE u.id=NEW.approver_id AND u.status='active') THEN RAISE EXCEPTION 'approver is not active' USING ERRCODE='OF005'; END IF;
  SELECT r.tier INTO tier FROM public.membership m JOIN public.app_role r ON r.code=m.role WHERE m.user_id=NEW.approver_id AND m.business_id=NEW.business_id AND m.revoked_at IS NULL;
  IF NEW.decision<>'rejected' AND ((NEW.action='confirm_figures' AND tier NOT IN ('T2','T3','T4')) OR (NEW.action IN ('send_message','commit_plan','compensate','override') AND tier NOT IN ('T3','T4'))) THEN RAISE EXCEPTION 'insufficient approval tier' USING ERRCODE='OF005'; END IF;
  IF NEW.decision<>'rejected' AND NEW.evaluation_id IS NOT NULL AND EXISTS(SELECT FROM public.evaluation e WHERE e.id=NEW.evaluation_id AND e.superseded_at IS NOT NULL) THEN RAISE EXCEPTION 'approval evaluation is stale' USING ERRCODE='OF005'; END IF;
  IF NEW.decision<>'rejected' AND NEW.action='send_message' THEN
   SELECT direction,status INTO legacy_message FROM public.negotiation_message WHERE id=NEW.message_id;
   IF legacy_message.direction IS DISTINCT FROM 'outbound' OR legacy_message.status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'only outbound drafts can be approved' USING ERRCODE='OF005'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO b FROM public.action_bundle WHERE business_id=NEW.business_id AND deal_id=NEW.deal_id AND id=NEW.bundle_id FOR SHARE;
 IF NOT FOUND OR b.action IS DISTINCT FROM NEW.action OR b.bundle_hash IS DISTINCT FROM NEW.action_plan_hash THEN
  RAISE EXCEPTION 'approval does not match exact bundle' USING ERRCODE='OF005'; END IF;
 IF NEW.evaluation_id IS DISTINCT FROM b.evaluation_id OR NEW.option_key IS DISTINCT FROM b.option_key THEN
  RAISE EXCEPTION 'approval evaluation mismatch' USING ERRCODE='OF005'; END IF;
 IF NEW.decision='rejected' THEN RETURN NEW; END IF;
 IF NEW.approver_id IS DISTINCT FROM public.app_user_id() THEN RAISE EXCEPTION 'approval actor mismatch' USING ERRCODE='OF005'; END IF;
 SELECT r.tier INTO tier FROM public.membership m JOIN public.app_role r ON r.code=m.role
 WHERE m.business_id=NEW.business_id AND m.user_id=NEW.approver_id AND m.revoked_at IS NULL;
 IF tier NOT IN ('T3','T4') OR NOT EXISTS(SELECT FROM public.app_user u WHERE u.id=NEW.approver_id AND u.status='active')
 THEN RAISE EXCEPTION 'current T3 membership required' USING ERRCODE='OF005'; END IF;
 IF b.expires_at<=clock_timestamp() OR EXISTS(SELECT FROM public.approval_revocation r WHERE r.approval_id=NEW.id)
 THEN RAISE EXCEPTION 'bundle expired or revoked' USING ERRCODE='OF005'; END IF;
 IF NEW.step_up_verified_at IS NULL OR NEW.idempotency_key IS NULL THEN
  RAISE EXCEPTION 'step-up required' USING ERRCODE='OF005'; END IF;
 SELECT * INTO grant_row FROM public.step_up_grant g WHERE g.id=NEW.step_up_grant_id
  AND g.business_id=NEW.business_id AND g.user_id=NEW.approver_id
  AND g.session_id=nullif(current_setting('app.session_id',true),'')::uuid
  AND g.bundle_id=b.id AND g.purpose=b.action AND g.bundle_hash=b.bundle_hash
  AND g.consumed_at IS NULL AND g.expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'step-up grant is invalid or consumed' USING ERRCODE='OF005'; END IF;
 UPDATE public.step_up_grant SET consumed_at=clock_timestamp() WHERE id=grant_row.id;
 SELECT * INTO current_deal FROM public.deal WHERE id=b.deal_id AND business_id=b.business_id;
 IF current_deal.input_version<>b.input_version OR
  (SELECT financial_revision FROM public.business WHERE id=b.business_id)<>b.financial_revision OR
  current_deal.status NOT IN ('awaiting_approval','awaiting_reply') OR
  EXISTS(SELECT FROM public.deal_flag f WHERE f.deal_id=b.deal_id AND f.business_id=b.business_id AND f.blocking AND f.resolved_at IS NULL)
 THEN RAISE EXCEPTION 'bundle is stale or blocked' USING ERRCODE='OF005'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION p5_message_frozen() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE run_id uuid; item_key text; allowed boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable preparation' USING ERRCODE='OF010'; END IF;
 IF EXISTS(SELECT FROM public.reply_candidate_set WHERE id=OLD.id) THEN RAISE EXCEPTION 'immutable preparation' USING ERRCODE='OF010'; END IF;
 IF EXISTS(SELECT FROM public.prepared_message WHERE id=OLD.id) THEN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.subject IS DISTINCT FROM OLD.subject
   OR NEW.direction IS DISTINCT FROM OLD.direction OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
   OR NEW.round IS DISTINCT FROM OLD.round OR NEW.counterparty_kind IS DISTINCT FROM OLD.counterparty_kind
   OR NEW.channel IS DISTINCT FROM OLD.channel THEN RAISE EXCEPTION 'immutable preparation content' USING ERRCODE='OF010'; END IF;
  run_id:=nullif(current_setting('app.execution_run_id',true),'')::uuid;
  item_key:=nullif(current_setting('app.execution_item_key',true),'');
  SELECT EXISTS(SELECT FROM public.execution_action x JOIN public.execution_run r ON r.id=x.run_id
   JOIN public.action_bundle_item i ON i.bundle_id=x.bundle_id AND i.item_key=x.item_key
   WHERE x.run_id=run_id AND x.item_key=item_key AND x.message_id=OLD.id
    AND r.business_id=OLD.business_id AND r.deal_id=OLD.deal_id AND r.run_kind='send_message'
    AND x.status='sent' AND i.kind='message') INTO allowed;
  IF NOT allowed OR NEW.status IS DISTINCT FROM 'sent' OR OLD.status NOT IN ('draft','approved')
   OR NEW.sent_at IS NULL THEN RAISE EXCEPTION 'message transition requires exact executed item' USING ERRCODE='OF006'; END IF;
  RETURN NEW;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION execution_action_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.approval; b public.action_bundle; i public.action_bundle_item; r public.execution_run;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'drafted' THEN RAISE EXCEPTION 'execution action starts drafted' USING ERRCODE='OF007'; END IF;
  IF NEW.run_id IS NULL AND NEW.bundle_id IS NULL AND NEW.item_key IS NULL THEN RETURN NEW; END IF;
  IF NEW.run_id IS NULL OR NEW.bundle_id IS NULL OR NEW.item_key IS NULL THEN
   RAISE EXCEPTION 'incomplete execution run item reference' USING ERRCODE='OF007'; END IF;
  SELECT * INTO r FROM public.execution_run WHERE id=NEW.run_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
  SELECT * INTO a FROM public.approval WHERE id=r.approval_id AND business_id=r.business_id AND deal_id=r.deal_id;
  SELECT * INTO b FROM public.action_bundle WHERE id=r.bundle_id AND business_id=r.business_id;
  SELECT * INTO i FROM public.action_bundle_item WHERE bundle_id=r.bundle_id AND item_key=NEW.item_key AND business_id=r.business_id;
  IF NOT FOUND OR a.bundle_id<>b.id OR a.action<>r.run_kind OR a.action_plan_hash<>NEW.plan_hash
   OR b.bundle_hash<>NEW.plan_hash OR i.kind<>(CASE NEW.kind WHEN 'message' THEN 'message' WHEN 'ledger_entry' THEN 'ledger_entry' WHEN 'lender_acceptance' THEN 'lender_acceptance' ELSE 'cancellation' END)
   OR i.message_id IS DISTINCT FROM NEW.message_id OR a.decision<>'approved'
   OR a.expires_at<=clock_timestamp() OR b.expires_at<=clock_timestamp()
   OR EXISTS(SELECT FROM public.approval_revocation z WHERE z.approval_id=a.id)
   OR EXISTS(SELECT FROM public.evaluation e WHERE e.id=b.evaluation_id AND e.superseded_at IS NOT NULL)
   OR NOT EXISTS(SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
    WHERE m.business_id=r.business_id AND m.user_id=a.approver_id AND m.revoked_at IS NULL
     AND m.role IN ('risk_officer','owner') AND u.status='active') THEN
   RAISE EXCEPTION 'invalid exact-bundle execution authority' USING ERRCODE='OF007'; END IF;
 ELSE
  IF NEW.business_id IS DISTINCT FROM OLD.business_id OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
   OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.payee_id IS DISTINCT FROM OLD.payee_id
   OR NEW.message_id IS DISTINCT FROM OLD.message_id OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
   OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR NEW.payload IS DISTINCT FROM OLD.payload
   OR NEW.plan_hash IS DISTINCT FROM OLD.plan_hash OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
   OR NEW.run_id IS DISTINCT FROM OLD.run_id OR NEW.bundle_id IS DISTINCT FROM OLD.bundle_id OR NEW.item_key IS DISTINCT FROM OLD.item_key
   THEN RAISE EXCEPTION 'execution manifest item is immutable' USING ERRCODE='OF007'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='drafted' AND NEW.status IN ('scheduled','voided','cancelled'))
   OR (OLD.status='scheduled' AND NEW.status IN ('sent','posted','accepted','failed','cancelled','voided'))
   OR (OLD.status='failed' AND NEW.status='scheduled')) THEN RAISE EXCEPTION 'illegal execution transition' USING ERRCODE='OF007'; END IF;
  NEW.updated_at:=clock_timestamp();
  IF NEW.status IN ('sent','posted','accepted') AND NEW.executed_at IS NULL THEN NEW.executed_at:=clock_timestamp(); END IF;
  IF NEW.status IN ('scheduled','sent','posted','accepted') AND NEW.status IS DISTINCT FROM OLD.status AND OLD.run_id IS NOT NULL THEN
   SELECT * INTO r FROM public.execution_run WHERE id=NEW.run_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
   SELECT * INTO a FROM public.approval WHERE id=r.approval_id AND business_id=r.business_id AND deal_id=r.deal_id;
   SELECT * INTO b FROM public.action_bundle WHERE id=r.bundle_id AND business_id=r.business_id;
   IF a.decision<>'approved' OR a.bundle_id<>b.id OR a.action<>r.run_kind OR a.expires_at<=clock_timestamp()
    OR b.expires_at<=clock_timestamp() OR EXISTS(SELECT FROM public.approval_revocation z WHERE z.approval_id=a.id)
    OR NOT EXISTS(SELECT FROM public.operation o JOIN public.auth_session s ON s.id=o.session_id AND s.user_id=o.actor_user_id
      JOIN public.membership m ON m.user_id=o.actor_user_id AND m.business_id=o.business_id
      JOIN public.app_user u ON u.id=o.actor_user_id WHERE o.id=r.operation_id AND o.business_id=r.business_id
       AND o.session_id=nullif(current_setting('app.session_id',true),'')::uuid
       AND o.actor_user_id=public.app_user_id() AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
       AND s.last_active_at>clock_timestamp()-interval '30 minutes' AND m.revoked_at IS NULL
       AND m.role IN ('risk_officer','owner') AND u.status='active' AND NOT u.mfa_enforced)
    OR (r.run_kind<>'compensate' AND ((SELECT input_version FROM public.deal WHERE id=b.deal_id)<>b.input_version
      OR (SELECT financial_revision FROM public.business WHERE id=b.business_id)<>b.financial_revision))
   THEN RAISE EXCEPTION 'execution authorization revoked, stale, or expired' USING ERRCODE='OF007'; END IF;
  ELSIF NEW.status IN ('scheduled','sent','posted','accepted') AND NEW.status IS DISTINCT FROM OLD.status THEN
   SELECT * INTO a FROM public.approval WHERE id=NEW.approval_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
   IF NOT FOUND OR a.decision NOT IN ('approved','edited') OR a.action NOT IN ('send_message','commit_plan','compensate')
    OR a.action_plan_hash IS DISTINCT FROM NEW.plan_hash OR (a.expires_at IS NOT NULL AND a.expires_at<=clock_timestamp())
    OR (a.evaluation_id IS NOT NULL AND EXISTS(SELECT FROM public.evaluation e WHERE e.id=a.evaluation_id AND e.superseded_at IS NOT NULL))
   THEN RAISE EXCEPTION 'legacy execution approval invalid' USING ERRCODE='OF007'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION p6_bank_blocker() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE rid uuid;
BEGIN
 IF OLD.code='P5-BANK-CHANGE' THEN
  IF NEW.code IS DISTINCT FROM OLD.code OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
   OR NEW.business_id IS DISTINCT FROM OLD.business_id THEN
   RAISE EXCEPTION 'bank verification hold identity is immutable' USING ERRCODE='OF002'; END IF;
  IF NEW.resolved_at IS NOT NULL OR NOT NEW.blocking THEN
   rid:=nullif(current_setting('app.bank_resolution_id',true),'')::uuid;
   IF rid IS NULL OR NOT EXISTS(SELECT FROM public.bank_verification_resolution r
     JOIN public.payee_bank_account a ON a.id=r.account_id AND a.business_id=r.business_id
    JOIN public.reply_candidate_set q ON q.id=r.source_reply_id AND q.business_id=r.business_id AND q.deal_id=r.deal_id
    WHERE r.id=rid AND r.flag_id=OLD.id AND r.business_id=OLD.business_id AND r.deal_id=OLD.deal_id
     AND r.actor_user_id=public.app_user_id() AND a.status='verified' AND a.account_fingerprint=r.verified_fingerprint
     AND a.payee_id=(q.payload->>'party_id')::uuid AND (q.payload->>'bank_change')::boolean IS TRUE
     AND length(btrim(r.evidence))>=12) THEN
     RAISE EXCEPTION 'bank verification evidence required' USING ERRCODE='OF002'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION p6_bank_resolution_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.actor_user_id<>public.app_user_id() OR NOT EXISTS(
  SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
  WHERE m.user_id=NEW.actor_user_id AND m.business_id=NEW.business_id AND m.revoked_at IS NULL
   AND m.role IN ('risk_officer','owner') AND u.status='active')
  OR NOT EXISTS(SELECT FROM public.auth_session s WHERE s.id=nullif(current_setting('app.session_id',true),'')::uuid
   AND s.user_id=NEW.actor_user_id AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
   AND s.last_active_at>clock_timestamp()-interval '30 minutes')
  OR NOT EXISTS(SELECT FROM public.reply_candidate_set q WHERE q.id=NEW.source_reply_id
   AND q.business_id=NEW.business_id AND q.deal_id=NEW.deal_id
   AND (q.payload->>'bank_change')::boolean IS TRUE)
  OR NOT EXISTS(SELECT FROM public.payee_bank_account a WHERE a.id=NEW.account_id AND a.business_id=NEW.business_id
   AND a.status='verified' AND a.account_fingerprint=NEW.verified_fingerprint)
 THEN RAISE EXCEPTION 'bank resolution requires current T3 review of the exact bank-change reply and verified account' USING ERRCODE='OF002'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_bank_resolution_validate BEFORE INSERT ON bank_verification_resolution
 FOR EACH ROW EXECUTE FUNCTION p6_bank_resolution_guard();
DROP TRIGGER p5_bank_blocker ON deal_flag;
CREATE TRIGGER p6_bank_blocker BEFORE UPDATE ON deal_flag FOR EACH ROW EXECUTE FUNCTION p6_bank_blocker();

CREATE OR REPLACE FUNCTION execution_run_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.business_id<>OLD.business_id OR NEW.deal_id<>OLD.deal_id OR NEW.bundle_id<>OLD.bundle_id
  OR NEW.approval_id<>OLD.approval_id OR NEW.run_kind<>OLD.run_kind OR NEW.idempotency_key<>OLD.idempotency_key
  OR NEW.fencing_token<>OLD.fencing_token) THEN RAISE EXCEPTION 'run identity immutable' USING ERRCODE='OF007'; END IF;
 IF TG_OP='UPDATE' AND NOT ((OLD.status='queued' AND NEW.status IN ('running','cancelled','failed'))
  OR (OLD.status='running' AND NEW.status IN ('running','succeeded','partial','failed','cancelled'))
  OR (OLD.status='partial' AND NEW.status IN ('running','partial','succeeded','failed','cancelled'))) THEN
  RAISE EXCEPTION 'illegal execution run transition' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER execution_run_guard_biu BEFORE INSERT OR UPDATE ON execution_run FOR EACH ROW EXECUTE FUNCTION execution_run_guard();

CREATE OR REPLACE FUNCTION p6_validate_bundle() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF sha256(NEW.canonical_manifest)<>NEW.bundle_hash OR convert_from(NEW.canonical_manifest,'UTF8')::jsonb<>NEW.manifest
  OR NEW.sandbox IS NOT TRUE OR jsonb_array_length(coalesce(NEW.manifest->'items','[]'::jsonb))=0 THEN
  RAISE EXCEPTION 'invalid canonical sandbox manifest' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER action_bundle_validate BEFORE INSERT ON action_bundle FOR EACH ROW EXECUTE FUNCTION p6_validate_bundle();

CREATE OR REPLACE FUNCTION p6_bundle_item_validate() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE b public.action_bundle; BEGIN
 SELECT * INTO b FROM public.action_bundle WHERE id=NEW.bundle_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
 IF NOT FOUND OR b.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT FROM jsonb_array_elements(b.manifest->'items') x
  WHERE x->>'key'=NEW.item_key AND x->>'kind'=NEW.kind
   AND sha256(convert_to(x::text,'UTF8'))=NEW.item_hash) THEN
  RAISE EXCEPTION 'bundle item is not in exact manifest' USING ERRCODE='OF007'; END IF;
 IF NEW.kind='message' AND NOT EXISTS(
  SELECT FROM public.negotiation_message m JOIN public.prepared_message p
   ON p.business_id=m.business_id AND p.deal_id=m.deal_id AND p.id=m.id
  WHERE m.business_id=NEW.business_id AND m.deal_id=NEW.deal_id AND m.id=NEW.message_id
   AND m.direction='outbound' AND m.status='draft'
   AND NEW.payload->>'message_id'=m.id::text
   AND NEW.payload->>'body'=m.body
   AND NEW.payload->>'subject' IS NOT DISTINCT FROM m.subject
   AND NEW.payload->>'channel'=m.channel
   AND NEW.payload->>'recipient'=p.payload->>'recipient'
   AND NEW.payload->>'party_id'=p.payload->>'party_id'
   AND NEW.payload->>'party_version'=(p.payload->>'party_version')
   AND NEW.payload->>'terms_hash'=p.payload->>'terms_hash'
   AND NEW.terms_hash=decode(p.payload->>'terms_hash','hex')) THEN
  RAISE EXCEPTION 'message content or recipient differs from frozen preparation' USING ERRCODE='OF007'; END IF;
 IF b.action='send_message' AND NEW.kind<>'message' OR b.action='compensate' AND NEW.kind<>'cancellation' THEN
  RAISE EXCEPTION 'action kind cannot authorize item kind' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER action_bundle_item_validate BEFORE INSERT ON action_bundle_item FOR EACH ROW EXECUTE FUNCTION p6_bundle_item_validate();

CREATE OR REPLACE FUNCTION p6_approval_current() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.bundle_id IS NOT NULL AND NEW.decision='approved' THEN
  IF NEW.expires_at IS NULL OR NEW.expires_at>(SELECT expires_at FROM public.action_bundle WHERE id=NEW.bundle_id)
   OR NEW.expires_at<=clock_timestamp() OR NEW.step_up_verified_at>clock_timestamp()
   OR NEW.step_up_verified_at<clock_timestamp()-interval '5 minutes' THEN RAISE EXCEPTION 'invalid approval expiry or step-up time' USING ERRCODE='OF005'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_approval_current_bi BEFORE INSERT ON approval FOR EACH ROW EXECUTE FUNCTION p6_approval_current();
CREATE OR REPLACE FUNCTION p6_required_acceptances() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b public.action_bundle; req jsonb; aid uuid;
BEGIN
 SELECT * INTO b FROM public.action_bundle WHERE id=NEW.bundle_id AND business_id=NEW.business_id;
 IF NEW.bundle_id IS NULL OR b.action<>'commit_plan' OR NEW.decision<>'approved' THEN RETURN NEW; END IF;
 IF jsonb_typeof(b.manifest->'required_acceptances') IS DISTINCT FROM 'array'
  OR jsonb_array_length(b.manifest->'required_acceptances')=0 THEN
  RAISE EXCEPTION 'commit requires exact party acceptances' USING ERRCODE='OF005'; END IF;
 FOR req IN SELECT value FROM jsonb_array_elements(b.manifest->'required_acceptances') LOOP
  aid:=nullif(req->>'acceptance_id','')::uuid;
  IF aid IS NULL OR NOT EXISTS(SELECT FROM public.party_acceptance a
    JOIN public.prepared_message p ON p.business_id=a.business_id AND p.deal_id=a.deal_id AND p.id=a.message_id
   WHERE a.id=aid AND a.business_id=b.business_id AND a.deal_id=b.deal_id
    AND a.payload->>'party_id'=req->>'party_id'
    AND a.payload->>'party_role'=req->>'party_role'
    AND a.payload->>'terms_hash'=req->>'terms_hash'
    AND (a.payload->>'valid_until')::timestamptz>clock_timestamp()
    AND p.evaluation_id=b.evaluation_id AND p.option_key=b.option_key
    AND p.payload->>'party_id'=req->>'party_id'
    AND p.payload->>'terms_hash'=req->>'terms_hash') THEN
   RAISE EXCEPTION 'required party acceptance is missing, stale, expired, or mismatched' USING ERRCODE='OF005';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_required_acceptances_bi BEFORE INSERT ON approval FOR EACH ROW EXECUTE FUNCTION p6_required_acceptances();

-- Keep executed sandbox facts and original actions immutable; one effect per action.
CREATE OR REPLACE FUNCTION p6_effect_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.execution_action x JOIN public.execution_run r ON r.id=x.run_id
  WHERE x.id=NEW.action_id AND x.business_id=NEW.business_id AND x.status IN ('sent','posted','accepted')
   AND r.status IN ('running','partial','succeeded')) THEN RAISE EXCEPTION 'effect requires completed sandbox action' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sandbox_effect_validate BEFORE INSERT ON sandbox_effect FOR EACH ROW EXECUTE FUNCTION p6_effect_guard();

CREATE OR REPLACE FUNCTION p6_revocation_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.approval a WHERE a.id=NEW.approval_id AND a.business_id=NEW.business_id
   AND a.deal_id=NEW.deal_id AND a.decision='approved') OR NEW.actor_user_id<>public.app_user_id()
  OR NOT EXISTS(SELECT FROM public.membership m WHERE m.user_id=NEW.actor_user_id AND m.business_id=NEW.business_id
   AND m.revoked_at IS NULL AND m.role IN ('risk_officer','owner')) THEN
  RAISE EXCEPTION 'approval revocation requires current T3 actor' USING ERRCODE='OF005'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER approval_revocation_validate BEFORE INSERT ON approval_revocation FOR EACH ROW EXECUTE FUNCTION p6_revocation_guard();

-- Prevent direct API use of pre-P6 action paths. New execution rows must be run-linked.
REVOKE INSERT,UPDATE,DELETE ON action_bundle,action_bundle_item,approval_revocation,execution_run,
 commitment_projection,sandbox_effect,bank_verification_resolution,commitment_gate FROM orderfit_app;
GRANT INSERT ON action_bundle,action_bundle_item,approval_revocation,execution_run,
 commitment_projection,sandbox_effect,bank_verification_resolution,commitment_gate TO orderfit_app;
GRANT UPDATE(status,started_at,finished_at,reconciliation_required) ON execution_run TO orderfit_app;
GRANT DELETE ON commitment_gate TO orderfit_app;
REVOKE INSERT,UPDATE ON execution_action FROM orderfit_app;
GRANT INSERT ON execution_action TO orderfit_app;
GRANT UPDATE ON execution_action TO orderfit_app;
REVOKE UPDATE ON step_up_grant FROM orderfit_app;
GRANT UPDATE(consumed_at) ON step_up_grant TO orderfit_app;
CREATE OR REPLACE FUNCTION message_status_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE rid uuid; ikey text;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.direction='outbound' AND NEW.status<>'draft' THEN RAISE EXCEPTION 'outbound starts draft' USING ERRCODE='OF006'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NOT ((OLD.status='draft' AND NEW.status IN ('approved','discarded'))
   OR (OLD.status='approved' AND NEW.status IN ('sent','discarded'))
   OR (OLD.status='draft' AND NEW.status='sent')) THEN RAISE EXCEPTION 'illegal message status transition' USING ERRCODE='OF006'; END IF;
  IF NEW.status='approved' AND NOT EXISTS(SELECT FROM public.approval a WHERE a.business_id=NEW.business_id
   AND a.deal_id=NEW.deal_id AND a.message_id=NEW.id AND a.message_sha256=NEW.body_sha256
   AND a.action='send_message' AND a.decision IN ('approved','edited')) THEN
   RAISE EXCEPTION 'no approval for current message body' USING ERRCODE='OF006';
  END IF;
  IF NEW.status='sent' AND EXISTS(SELECT FROM public.prepared_message WHERE business_id=OLD.business_id AND id=OLD.id) THEN
   rid:=nullif(current_setting('app.execution_run_id',true),'')::uuid;
   ikey:=nullif(current_setting('app.execution_item_key',true),'');
   IF rid IS NULL OR ikey IS NULL OR NOT EXISTS(SELECT FROM public.execution_action x
    JOIN public.action_bundle_item i ON i.business_id=x.business_id AND i.deal_id=x.deal_id
     AND i.bundle_id=x.bundle_id AND i.item_key=x.item_key
    WHERE x.run_id=rid AND x.item_key=ikey AND x.message_id=OLD.id AND x.status='sent' AND i.kind='message')
   THEN RAISE EXCEPTION 'message send requires exact executed bundle item' USING ERRCODE='OF006'; END IF;
  ELSIF NEW.status='sent' AND NOT EXISTS(SELECT FROM public.approval a WHERE a.business_id=OLD.business_id
   AND a.deal_id=OLD.deal_id AND a.message_id=OLD.id AND a.message_sha256=OLD.body_sha256
   AND a.action='send_message' AND a.decision IN ('approved','edited') AND (a.expires_at IS NULL OR a.expires_at>clock_timestamp())) THEN
   RAISE EXCEPTION 'legacy message approval invalid' USING ERRCODE='OF006';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION p6_check_manifest_items() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE b public.action_bundle; n integer; BEGIN
 SELECT * INTO b FROM public.action_bundle WHERE id=NEW.id AND business_id=NEW.business_id;
 SELECT count(*) INTO n FROM public.action_bundle_item WHERE bundle_id=NEW.id AND business_id=NEW.business_id;
 IF n<>jsonb_array_length(b.manifest->'items') OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(b.manifest->'items') x WHERE NOT EXISTS(
   SELECT FROM public.action_bundle_item i WHERE i.bundle_id=NEW.id AND i.item_key=x->>'key' AND i.kind=x->>'kind'
   AND i.item_hash=sha256(convert_to(x::text,'UTF8')))) THEN
  RAISE EXCEPTION 'bundle items differ from manifest' USING ERRCODE='OF007'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER p6_manifest_complete AFTER INSERT ON action_bundle
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION p6_check_manifest_items();
