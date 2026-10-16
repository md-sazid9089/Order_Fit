-- P6-B: sandbox execution, durable commitment serialization, projection and compensation.
-- Additive forward repair; every existing row is preserved. Proven insufficiencies of 0009/0010
-- under the restricted runtime login (regressions in tests/db/test_p6_execution.py):
-- 1. execution_action_guard rechecked approval/expiry but not p6_bundle_unusable_reason, so a
--    message superseded after approval, a withdrawn acceptance or a new hold was not refused
--    by SQL at execution. Admission/items now share p6_approval_unusable_reason().
-- 2. A commit needs engine-dated customer receipts, payee-less costs and loan fee/interest/
--    repayment events. No manifest item kind could carry or attribute them, and evaluations
--    stored no dated events. Adds the 'commitment' item kind plus immutable per-option engine
--    output (evaluation_projection) that a commitment item must match exactly.
-- 3. foundation_child_revision bumped the business revision (and the committed deal's input
--    version/evaluation) once per projected cash_event row. Projection rows written by the
--    running commit/compensation run now skip that per-row bump; an immutable settlement row
--    validates completeness and bumps the business revision exactly once.
-- 4. p5_message_frozen let only send_message runs mark a prepared message sent, so approved
--    commit confirmations could never be delivered to the sandbox outbox.
-- 6. 0009's per-effect actor check read auth_session, which the runtime role cannot read, so
--    every run-linked status transition failed with 42501.
-- 5. Nothing serialized the commitment gate lifecycle, settled runs whose job ended, or let a
--    recovered run be re-admitted under a new operation; and 0009's forbid_change() trigger
--    on execution_run made every granted status update fail (no run could start).

-- 1. Immutable engine output per evaluated option (base scenario, order+financing scope).
CREATE TABLE evaluation_projection (
 business_id uuid NOT NULL, evaluation_id uuid NOT NULL, option_key text NOT NULL,
 events jsonb NOT NULL CHECK(jsonb_typeof(events)='array'),
 PRIMARY KEY(evaluation_id,option_key), UNIQUE(business_id,evaluation_id,option_key),
 FOREIGN KEY(business_id,evaluation_id,option_key)
  REFERENCES evaluation_option(business_id,evaluation_id,option_key)
);
CREATE FUNCTION p6_projection_source_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 -- Only the publication transaction (deal still computing) may store engine output.
 IF public.app_is_restricted() AND NOT EXISTS(SELECT FROM public.evaluation e JOIN public.deal d
   ON d.business_id=e.business_id AND d.id=e.deal_id
  WHERE e.id=NEW.evaluation_id AND e.business_id=NEW.business_id AND e.superseded_at IS NULL
   AND d.status='computing') THEN
  RAISE EXCEPTION 'engine projection is stored only with its evaluation' USING ERRCODE='OF008'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_projection_source BEFORE INSERT ON evaluation_projection
 FOR EACH ROW EXECUTE FUNCTION p6_projection_source_guard();

-- 2. 'commitment' item kind (attribution for engine-dated receipts, costs and loan events).
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conrelid::regclass::text AS t, conname FROM pg_constraint
  WHERE contype='c' AND conrelid IN ('action_bundle_item'::regclass,'execution_action'::regclass)
   AND pg_get_constraintdef(oid) LIKE '%''lender_acceptance''%' LOOP
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.t, r.conname);
 END LOOP;
END $$;
ALTER TABLE action_bundle_item ADD CONSTRAINT action_bundle_item_kind_check
 CHECK(kind IN ('message','ledger_entry','lender_acceptance','cancellation','commitment'));
ALTER TABLE execution_action ADD CONSTRAINT execution_action_kind_check
 CHECK(kind IN ('ledger_entry','message','lender_acceptance','cancellation','commitment'));

CREATE FUNCTION p6_item_semantics() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b public.action_bundle; ev jsonb; orig public.execution_action; eff public.sandbox_effect;
BEGIN
 SELECT * INTO b FROM public.action_bundle WHERE id=NEW.bundle_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
 IF NEW.kind='commitment' THEN
  IF b.action<>'commit_plan' OR EXISTS(SELECT FROM public.action_bundle_item i
    WHERE i.bundle_id=NEW.bundle_id AND i.kind='commitment') THEN
   RAISE EXCEPTION 'one commitment item per commit bundle' USING ERRCODE='OF007'; END IF;
  SELECT p.events INTO ev FROM public.evaluation_projection p
   WHERE p.business_id=b.business_id AND p.evaluation_id=b.evaluation_id AND p.option_key=b.option_key;
  IF ev IS NULL OR NEW.payload->>'evaluation_id' IS DISTINCT FROM b.evaluation_id::text
   OR NEW.payload->>'option_key' IS DISTINCT FROM b.option_key
   OR jsonb_typeof(NEW.payload->'projections') IS DISTINCT FROM 'array'
   OR jsonb_array_length(NEW.payload->'projections')<>jsonb_array_length(ev)
   OR EXISTS(SELECT FROM jsonb_array_elements(ev) e WHERE NOT EXISTS(
    SELECT FROM jsonb_array_elements(NEW.payload->'projections') p
    WHERE p->>'event_key'=e->>'event_key' AND p->>'kind'=e->>'kind' AND p->>'event_date'=e->>'event_date'
     AND p->>'amount_minor'=e->>'amount_minor' AND p->>'direction'=e->>'direction'
     AND p->>'certainty'=e->>'certainty')) THEN
   RAISE EXCEPTION 'commitment projection differs from the evaluated engine output' USING ERRCODE='OF007'; END IF;
 ELSIF NEW.kind='cancellation' THEN
  IF b.action<>'compensate' THEN RAISE EXCEPTION 'only compensation lists reversals' USING ERRCODE='OF007'; END IF;
  SELECT * INTO orig FROM public.execution_action WHERE id=(NEW.payload->>'original_action_id')::uuid
   AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
  SELECT * INTO eff FROM public.sandbox_effect WHERE action_id=orig.id AND business_id=NEW.business_id;
  IF orig.id IS NULL OR orig.run_id IS NULL OR orig.kind='cancellation'
   OR orig.status NOT IN ('sent','posted','accepted') OR eff.action_id IS NULL
   OR encode(eff.payload_hash,'hex') IS DISTINCT FROM NEW.payload->>'original_payload_hash' THEN
   RAISE EXCEPTION 'reversal must reference a completed sandbox action and its exact effect' USING ERRCODE='OF007'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_item_semantics BEFORE INSERT ON action_bundle_item FOR EACH ROW EXECUTE FUNCTION p6_item_semantics();

-- 3. One shared run-settlement rule (job ended without the handler settling the run).
CREATE FUNCTION p6_interrupt_run(p_run uuid, p_cancelled boolean) RETURNS text LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.execution_run; done integer; target text;
BEGIN
 SELECT * INTO r FROM public.execution_run WHERE id=p_run FOR UPDATE;
 IF NOT FOUND OR r.status NOT IN ('queued','running','partial') THEN RETURN NULL; END IF;
 SELECT count(*) INTO done FROM public.execution_action WHERE run_id=r.id AND status IN ('sent','posted','accepted');
 IF done>0 THEN
  -- Completed effects cannot be undone by a stop: keep the gate, require reconciliation.
  target:='partial';
  UPDATE public.execution_run SET status='partial',reconciliation_required=true,finished_at=clock_timestamp() WHERE id=r.id;
 ELSIF r.status='partial' THEN
  RETURN 'partial';
 ELSE
  target:=CASE WHEN p_cancelled THEN 'cancelled' ELSE 'failed' END;
  UPDATE public.execution_run SET status=target,finished_at=clock_timestamp() WHERE id=r.id;
  DELETE FROM public.commitment_gate WHERE business_id=r.business_id AND run_id=r.id;
 END IF;
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION p6_interrupt_run(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p6_interrupt_run(uuid,boolean) TO orderfit_app;

CREATE FUNCTION p6_operation_settles_run() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE rid uuid; BEGIN
 FOR rid IN SELECT id FROM public.execution_run WHERE business_id=NEW.business_id AND operation_id=NEW.id
  AND status IN ('queued','running') LOOP
  PERFORM public.p6_interrupt_run(rid, NEW.status='cancelled');
 END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER p6_operation_settles_run AFTER UPDATE OF status ON operation FOR EACH ROW
 WHEN (NEW.kind='execute' AND NEW.status IN ('failed','cancelled') AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION p6_operation_settles_run();

-- Execution freshness is decided by the run's own guards, not by operation_finish's coarse
-- revision comparison (a run's own commit settlement bumps the revision it started with).
CREATE OR REPLACE FUNCTION operation_finish(p_id uuid,p_token uuid,p_result jsonb,p_retry boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job public.operation; b public.business; d public.deal; oldb text; oldu text; BEGIN
 SELECT * INTO job FROM public.operation WHERE id=p_id;
 IF NOT FOUND THEN RETURN false; END IF;
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
 ELSIF job.kind NOT IN ('extract','execute') AND (b.financial_revision<>job.financial_revision OR (job.deal_id IS NOT NULL AND d.input_version<>job.input_version)) THEN
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
GRANT EXECUTE ON FUNCTION operation_finish(uuid,uuid,jsonb,boolean) TO orderfit_worker;

-- 4. Run admission, one unresolved run per deal, resume under a new operation.
-- 0009 attached forbid_change() to execution_run while granting UPDATE(status,...), so no run
-- could ever leave 'queued'. Identity immutability is enforced by execution_run_guard instead;
-- deletion and truncation stay forbidden.
DROP TRIGGER immutable ON execution_run;
CREATE TRIGGER execution_run_no_delete BEFORE DELETE ON execution_run FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER execution_run_no_truncate BEFORE TRUNCATE ON execution_run FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
GRANT UPDATE(operation_id) ON execution_run TO orderfit_app;
CREATE INDEX execution_run_deal_status_idx ON execution_run(business_id,deal_id,status);
CREATE INDEX execution_action_run_idx ON execution_action(run_id) WHERE run_id IS NOT NULL;
CREATE OR REPLACE FUNCTION execution_run_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.approval; o public.operation; reason text;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'queued' OR NEW.reconciliation_required OR NEW.started_at IS NOT NULL OR NEW.finished_at IS NOT NULL THEN
   RAISE EXCEPTION 'execution run starts queued' USING ERRCODE='OF007'; END IF;
  SELECT * INTO a FROM public.approval WHERE id=NEW.approval_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
  IF NOT FOUND OR a.bundle_id IS DISTINCT FROM NEW.bundle_id OR a.action IS DISTINCT FROM NEW.run_kind THEN
   RAISE EXCEPTION 'run must use the approval of its exact bundle' USING ERRCODE='OF007'; END IF;
  reason:=public.p6_approval_unusable_reason(a.id);
  IF reason IS NOT NULL THEN RAISE EXCEPTION 'approval unusable at admission: %',reason USING ERRCODE='OF007'; END IF;
  SELECT * INTO o FROM public.operation WHERE id=NEW.operation_id AND business_id=NEW.business_id;
  IF NOT FOUND OR o.kind<>'execute' OR o.status<>'queued' OR o.deal_id IS DISTINCT FROM NEW.deal_id
   OR o.actor_user_id IS DISTINCT FROM public.app_user_id() OR o.parameters->>'run_id' IS DISTINCT FROM NEW.id::text
   OR NOT EXISTS(SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
    WHERE m.business_id=NEW.business_id AND m.user_id=o.actor_user_id AND m.revoked_at IS NULL
     AND m.role IN ('risk_officer','owner') AND u.status='active') THEN
   RAISE EXCEPTION 'run requires its queued execute operation by a current T3 actor' USING ERRCODE='OF007'; END IF;
  IF EXISTS(SELECT FROM public.execution_run x WHERE x.business_id=NEW.business_id AND x.deal_id=NEW.deal_id
   AND (x.status IN ('queued','running') OR (x.status='partial' AND x.run_kind<>'compensate' AND NEW.run_kind<>'compensate'))) THEN
   RAISE EXCEPTION 'another run of this deal is unresolved' USING ERRCODE='OF007'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.business_id<>OLD.business_id OR NEW.deal_id<>OLD.deal_id OR NEW.bundle_id<>OLD.bundle_id
  OR NEW.approval_id<>OLD.approval_id OR NEW.run_kind<>OLD.run_kind OR NEW.idempotency_key<>OLD.idempotency_key
  OR NEW.fencing_token<>OLD.fencing_token OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'run identity immutable' USING ERRCODE='OF007'; END IF;
 IF NEW.operation_id IS DISTINCT FROM OLD.operation_id THEN
  SELECT * INTO o FROM public.operation WHERE id=NEW.operation_id AND business_id=NEW.business_id;
  IF OLD.status NOT IN ('running','partial') OR NEW.status<>OLD.status OR NOT FOUND OR o.kind<>'execute'
   OR o.status<>'queued' OR o.parameters->>'run_id' IS DISTINCT FROM NEW.id::text
   OR EXISTS(SELECT FROM public.operation p WHERE p.id=OLD.operation_id AND p.status IN ('queued','running')) THEN
   RAISE EXCEPTION 'only an interrupted run resumes under a new operation' USING ERRCODE='OF007'; END IF;
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='queued' AND NEW.status IN ('running','cancelled','failed'))
  OR (OLD.status='running' AND NEW.status IN ('succeeded','partial','failed','cancelled'))
  OR (OLD.status='partial' AND NEW.status IN ('running','succeeded','failed','cancelled'))) THEN
  RAISE EXCEPTION 'illegal execution run transition' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION p6_commit_gate_required() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.run_kind='commit_plan' AND NOT EXISTS(SELECT FROM public.commitment_gate g
   WHERE g.business_id=NEW.business_id AND g.run_id=NEW.id) THEN
  RAISE EXCEPTION 'commit run must claim the business commitment gate atomically' USING ERRCODE='OF007'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER p6_commit_gate_required AFTER INSERT ON execution_run
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION p6_commit_gate_required();

-- The gate is released only by settlement, by a run that executed nothing, or after every
-- completed action of an interrupted commit has an approved, completed reversal.
CREATE FUNCTION p6_gate_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.execution_run; done integer;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO r FROM public.execution_run WHERE id=NEW.run_id AND business_id=NEW.business_id;
  IF NOT FOUND OR r.run_kind<>'commit_plan' OR r.status<>'queued' THEN
   RAISE EXCEPTION 'only a newly admitted commit run claims the gate' USING ERRCODE='OF007'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO r FROM public.execution_run WHERE id=OLD.run_id AND business_id=OLD.business_id;
 SELECT count(*) INTO done FROM public.execution_action WHERE run_id=r.id AND status IN ('sent','posted','accepted');
 IF (r.status='succeeded' AND EXISTS(SELECT FROM public.commitment_settlement s WHERE s.run_id=r.id))
  OR (r.status IN ('failed','cancelled') AND done=0)
  OR (r.status IN ('partial','failed','cancelled') AND done>0 AND NOT EXISTS(
   SELECT FROM public.execution_action x WHERE x.run_id=r.id AND x.status IN ('sent','posted','accepted')
    AND NOT EXISTS(SELECT FROM public.execution_action c JOIN public.execution_run cr ON cr.id=c.run_id
     WHERE c.business_id=x.business_id AND c.kind='cancellation' AND c.status IN ('sent','posted','accepted')
      AND cr.status='succeeded' AND c.payload->>'original_action_id'=x.id::text))) THEN
  RETURN OLD;
 END IF;
 RAISE EXCEPTION 'commitment gate stays held until settlement or explicit reconciliation' USING ERRCODE='OF007';
END $$;
CREATE TRIGGER p6_gate_guard BEFORE INSERT OR DELETE ON commitment_gate FOR EACH ROW EXECUTE FUNCTION p6_gate_guard();

-- 5. Exact item authority at admission and at every effect. Reversals bind original effects.
CREATE FUNCTION p6_check_reversal(p_action public.execution_action) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE orig public.execution_action; eff public.sandbox_effect;
BEGIN
 SELECT * INTO orig FROM public.execution_action WHERE id=(p_action.payload->>'original_action_id')::uuid
  AND business_id=p_action.business_id AND deal_id=p_action.deal_id;
 SELECT * INTO eff FROM public.sandbox_effect WHERE action_id=orig.id AND business_id=p_action.business_id;
 IF orig.id IS NULL OR orig.run_id IS NULL OR orig.kind='cancellation' OR orig.status NOT IN ('sent','posted','accepted')
  OR eff.action_id IS NULL OR encode(eff.payload_hash,'hex') IS DISTINCT FROM p_action.payload->>'original_payload_hash' THEN
  RAISE EXCEPTION 'reversal target is not the exact completed sandbox action' USING ERRCODE='OF007'; END IF;
 IF EXISTS(SELECT FROM public.execution_action c JOIN public.execution_run cr ON cr.id=c.run_id
  WHERE c.business_id=p_action.business_id AND c.kind='cancellation' AND c.id<>p_action.id
   AND c.payload->>'original_action_id'=orig.id::text
   AND (c.status IN ('sent','posted','accepted') OR cr.status IN ('queued','running','partial'))) THEN
  RAISE EXCEPTION 'original action is already reversed or pending reversal' USING ERRCODE='OF007'; END IF;
END $$;
CREATE UNIQUE INDEX execution_action_one_reversal ON execution_action((payload->>'original_action_id'))
 WHERE kind='cancellation' AND status IN ('sent','posted','accepted');

-- 0009's per-effect actor check read auth_session, which the runtime role cannot read (42501),
-- so no run-linked action could ever complete. A narrow definer predicate answers only for the
-- caller's own running operation in the current tenant/session.
CREATE FUNCTION p6_run_actor_current(p_op uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.operation o JOIN public.auth_session s ON s.id=o.session_id AND s.user_id=o.actor_user_id
  JOIN public.membership m ON m.user_id=o.actor_user_id AND m.business_id=o.business_id
  JOIN public.app_user u ON u.id=o.actor_user_id
  WHERE o.id=p_op AND o.business_id=public.app_business_id() AND o.kind='execute' AND o.status='running'
   AND NOT o.cancellation_requested AND o.lease_expires_at>clock_timestamp()
   AND o.session_id=nullif(current_setting('app.session_id',true),'')::uuid AND o.actor_user_id=public.app_user_id()
   AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes'
   AND m.revoked_at IS NULL AND m.role IN ('risk_officer','owner') AND u.status='active' AND NOT u.mfa_enforced)
$$;
REVOKE ALL ON FUNCTION p6_run_actor_current(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p6_run_actor_current(uuid) TO orderfit_app;

CREATE OR REPLACE FUNCTION execution_action_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.approval; b public.action_bundle; i public.action_bundle_item; r public.execution_run; reason text;
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
  IF NOT FOUND OR r.status<>'queued' OR r.bundle_id<>NEW.bundle_id OR NEW.approval_id IS DISTINCT FROM a.id
   OR a.bundle_id<>b.id OR a.action<>r.run_kind OR a.action_plan_hash<>NEW.plan_hash OR b.bundle_hash<>NEW.plan_hash
   OR i.kind<>NEW.kind OR i.message_id IS DISTINCT FROM NEW.message_id OR NEW.payload<>i.payload
   OR sha256(convert_to(NEW.payload::text,'UTF8'))<>i.item_hash OR a.decision<>'approved' THEN
   RAISE EXCEPTION 'invalid exact-bundle execution authority' USING ERRCODE='OF007'; END IF;
  reason:=public.p6_approval_unusable_reason(a.id);
  IF reason IS NOT NULL THEN RAISE EXCEPTION 'execution authorization unusable: %',reason USING ERRCODE='OF007'; END IF;
  IF NEW.kind='cancellation' THEN PERFORM public.p6_check_reversal(NEW); END IF;
  RETURN NEW;
 END IF;
 IF NEW.business_id IS DISTINCT FROM OLD.business_id OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
  OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.payee_id IS DISTINCT FROM OLD.payee_id
  OR NEW.message_id IS DISTINCT FROM OLD.message_id OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
  OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR NEW.payload IS DISTINCT FROM OLD.payload
  OR NEW.plan_hash IS DISTINCT FROM OLD.plan_hash OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
  OR NEW.run_id IS DISTINCT FROM OLD.run_id OR NEW.bundle_id IS DISTINCT FROM OLD.bundle_id OR NEW.item_key IS DISTINCT FROM OLD.item_key
  OR (OLD.run_id IS NOT NULL AND NEW.approval_id IS DISTINCT FROM OLD.approval_id)
  THEN RAISE EXCEPTION 'execution manifest item is immutable' USING ERRCODE='OF007'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='drafted' AND NEW.status IN ('scheduled','voided','cancelled'))
  OR (OLD.status='scheduled' AND NEW.status IN ('sent','posted','accepted','failed','cancelled','voided'))
  OR (OLD.status='failed' AND NEW.status='scheduled')) THEN RAISE EXCEPTION 'illegal execution transition' USING ERRCODE='OF007'; END IF;
 NEW.updated_at:=clock_timestamp();
 IF NEW.status IN ('sent','posted','accepted') AND NEW.executed_at IS NULL THEN NEW.executed_at:=clock_timestamp(); END IF;
 IF NEW.status IN ('scheduled','sent','posted','accepted') AND NEW.status IS DISTINCT FROM OLD.status AND OLD.run_id IS NOT NULL THEN
  SELECT * INTO r FROM public.execution_run WHERE id=NEW.run_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
  SELECT * INTO a FROM public.approval WHERE id=r.approval_id AND business_id=r.business_id AND deal_id=r.deal_id;
  reason:=public.p6_approval_unusable_reason(a.id);
  IF reason IS NOT NULL OR r.status<>'running' OR a.bundle_id IS DISTINCT FROM r.bundle_id OR a.action<>r.run_kind
   OR NOT public.p6_run_actor_current(r.operation_id)
  THEN RAISE EXCEPTION 'execution authorization revoked, stale, or expired: %',coalesce(reason,'RUN_CONTEXT') USING ERRCODE='OF007'; END IF;
  IF NEW.kind='cancellation' THEN PERFORM public.p6_check_reversal(NEW); END IF;
 ELSIF NEW.status IN ('scheduled','sent','posted','accepted') AND NEW.status IS DISTINCT FROM OLD.status THEN
  SELECT * INTO a FROM public.approval WHERE id=NEW.approval_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
  IF NOT FOUND OR a.decision NOT IN ('approved','edited') OR a.action NOT IN ('send_message','commit_plan','compensate')
   OR a.action_plan_hash IS DISTINCT FROM NEW.plan_hash OR (a.expires_at IS NOT NULL AND a.expires_at<=clock_timestamp())
   OR (a.evaluation_id IS NOT NULL AND EXISTS(SELECT FROM public.evaluation e WHERE e.id=a.evaluation_id AND e.superseded_at IS NOT NULL))
  THEN RAISE EXCEPTION 'legacy execution approval invalid' USING ERRCODE='OF007'; END IF;
 END IF;
 RETURN NEW;
END $$;

-- Exactly one effect kind per item kind, written only by the running run, sandbox only.
CREATE OR REPLACE FUNCTION p6_effect_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.execution_action x JOIN public.execution_run r ON r.id=x.run_id
  WHERE x.id=NEW.action_id AND x.business_id=NEW.business_id AND x.status IN ('sent','posted','accepted')
   AND r.status='running'
   AND NEW.effect_kind=CASE x.kind WHEN 'message' THEN 'outbox' WHEN 'ledger_entry' THEN 'ledger'
    WHEN 'commitment' THEN 'ledger' WHEN 'lender_acceptance' THEN 'lender_simulation' ELSE 'inverse' END
   AND NEW.payload->>'action_id'=x.id::text AND NEW.payload->>'sandbox'='true'
   AND (x.kind<>'cancellation' OR NEW.payload->>'original_action_id'=x.payload->>'original_action_id'))
 THEN RAISE EXCEPTION 'effect requires its completed sandbox action in a running run' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;

-- 6. Approved commit confirmations may be delivered to the sandbox outbox too. (0009's version
--    also compared x.run_id with a same-named PL/pgSQL variable: 42702 on every send.)
CREATE OR REPLACE FUNCTION p5_message_frozen() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_run uuid; v_key text; allowed boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable preparation' USING ERRCODE='OF010'; END IF;
 IF EXISTS(SELECT FROM public.reply_candidate_set WHERE id=OLD.id) THEN RAISE EXCEPTION 'immutable preparation' USING ERRCODE='OF010'; END IF;
 IF EXISTS(SELECT FROM public.prepared_message WHERE id=OLD.id) THEN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.subject IS DISTINCT FROM OLD.subject
   OR NEW.direction IS DISTINCT FROM OLD.direction OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
   OR NEW.round IS DISTINCT FROM OLD.round OR NEW.counterparty_kind IS DISTINCT FROM OLD.counterparty_kind
   OR NEW.channel IS DISTINCT FROM OLD.channel THEN RAISE EXCEPTION 'immutable preparation content' USING ERRCODE='OF010'; END IF;
  v_run:=nullif(current_setting('app.execution_run_id',true),'')::uuid;
  v_key:=nullif(current_setting('app.execution_item_key',true),'');
  SELECT EXISTS(SELECT FROM public.execution_action x JOIN public.execution_run r ON r.id=x.run_id
   JOIN public.action_bundle_item i ON i.bundle_id=x.bundle_id AND i.item_key=x.item_key
   WHERE x.run_id=v_run AND x.item_key=v_key AND x.message_id=OLD.id
    AND r.business_id=OLD.business_id AND r.deal_id=OLD.deal_id AND r.run_kind IN ('send_message','commit_plan')
    AND r.status='running' AND x.status='sent' AND i.kind='message') INTO allowed;
  IF NOT allowed OR NEW.status IS DISTINCT FROM 'sent' OR OLD.status NOT IN ('draft','approved')
   OR NEW.sent_at IS NULL THEN RAISE EXCEPTION 'message transition requires exact executed item' USING ERRCODE='OF006'; END IF;
  RETURN NEW;
 END IF;
 RETURN NEW;
END $$;

-- 7. Projection writes by the running commit/compensation skip the per-row revision bump.
CREATE FUNCTION p6_projection_write(p_new jsonb, p_old jsonb) RETURNS boolean LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE rid uuid; r public.execution_run;
BEGIN
 rid:=nullif(current_setting('app.commitment_run_id',true),'')::uuid;
 IF rid IS NULL OR p_new->>'deal_id' IS NULL THEN RETURN false; END IF;
 SELECT * INTO r FROM public.execution_run WHERE id=rid AND business_id=(p_new->>'business_id')::uuid
  AND deal_id=(p_new->>'deal_id')::uuid AND status='running';
 IF NOT FOUND OR NOT EXISTS(SELECT FROM public.operation o WHERE o.id=r.operation_id AND o.status='running'
   AND o.actor_user_id=public.app_user_id() AND o.session_id=nullif(current_setting('app.session_id',true),'')::uuid) THEN
  RETURN false; END IF;
 IF p_old IS NULL THEN
  RETURN r.run_kind='commit_plan' AND EXISTS(SELECT FROM public.commitment_gate g WHERE g.business_id=r.business_id AND g.run_id=r.id);
 END IF;
 RETURN r.run_kind='compensate' AND p_old->>'voided_at' IS NULL AND p_new->>'voided_at' IS NOT NULL
  AND EXISTS(SELECT FROM public.commitment_projection p JOIN public.execution_action c ON c.run_id=r.id
   AND c.kind='cancellation' AND c.payload->>'original_action_id'=p.action_id::text
   WHERE p.business_id=r.business_id AND p.cash_event_id=(p_old->>'id')::bigint);
END $$;
CREATE OR REPLACE FUNCTION foundation_child_revision() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b uuid; d uuid; rowdata jsonb; BEGIN
 rowdata:=to_jsonb(NEW); b:=(rowdata->>'business_id')::uuid;
 IF TG_OP='UPDATE' AND ((rowdata->>'business_id') IS DISTINCT FROM (to_jsonb(OLD)->>'business_id')
  OR (rowdata->>'deal_id') IS DISTINCT FROM (to_jsonb(OLD)->>'deal_id')) THEN
  RAISE EXCEPTION 'immutable scope' USING ERRCODE='OF003'; END IF;
 IF TG_TABLE_NAME='cash_event' AND public.p6_projection_write(rowdata, CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END) THEN
  -- The run's settlement row bumps the business revision exactly once for the whole set.
  IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1; END IF;
  RETURN NEW;
 END IF;
 UPDATE public.business SET financial_revision=financial_revision+1 WHERE id=b;
 d:=(rowdata->>'deal_id')::uuid;
 IF d IS NOT NULL THEN
  UPDATE public.deal SET input_version=input_version+1 WHERE business_id=b AND id=d;
  UPDATE public.evaluation SET superseded_at=clock_timestamp() WHERE business_id=b AND deal_id=d AND superseded_at IS NULL;
 END IF;
 IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1; END IF;
 RETURN NEW;
END $$;
-- A projected commitment event is changed only by voiding it through approved compensation.
CREATE FUNCTION p6_projection_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT FROM public.commitment_projection p WHERE p.business_id=OLD.business_id AND p.cash_event_id=OLD.id) THEN
  -- Stored generated columns are not yet computed in NEW inside a BEFORE trigger.
  IF (to_jsonb(NEW)-ARRAY['voided_at','version','is_order_receipt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['voided_at','version','is_order_receipt'])
   OR NOT public.p6_projection_write(to_jsonb(NEW),to_jsonb(OLD)) THEN
   RAISE EXCEPTION 'projected commitment events change only through approved compensation' USING ERRCODE='OF010'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_projection_immutable BEFORE UPDATE ON cash_event FOR EACH ROW EXECUTE FUNCTION p6_projection_immutable();

CREATE FUNCTION p6_projection_link_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE x public.execution_action; r public.execution_run; b public.action_bundle; ce public.cash_event;
BEGIN
 SELECT * INTO x FROM public.execution_action WHERE id=NEW.action_id AND business_id=NEW.business_id;
 SELECT * INTO r FROM public.execution_run WHERE id=x.run_id AND business_id=NEW.business_id;
 SELECT * INTO b FROM public.action_bundle WHERE id=r.bundle_id AND business_id=NEW.business_id;
 SELECT * INTO ce FROM public.cash_event WHERE id=NEW.cash_event_id AND business_id=NEW.business_id;
 IF x.id IS NULL OR r.id IS NULL OR r.run_kind<>'commit_plan' OR r.status<>'running'
  OR x.status NOT IN ('sent','posted','accepted') OR r.deal_id<>NEW.deal_id OR b.id<>NEW.bundle_id
  OR b.evaluation_id<>NEW.evaluation_id OR ce.id IS NULL OR ce.deal_id IS DISTINCT FROM r.deal_id
  OR ce.voided_at IS NOT NULL OR ce.original_obligation_id IS DISTINCT FROM NEW.original_obligation_id
  OR NOT EXISTS(SELECT FROM public.commitment_gate g WHERE g.business_id=r.business_id AND g.run_id=r.id) THEN
  RAISE EXCEPTION 'projection must link a completed action of the gated running commit' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_projection_link BEFORE INSERT ON commitment_projection FOR EACH ROW EXECUTE FUNCTION p6_projection_link_guard();

-- 8. Immutable settlement (single revision bump) and projection reconciliation evidence.
CREATE TABLE commitment_settlement (
 business_id uuid NOT NULL, deal_id uuid NOT NULL, run_id uuid NOT NULL PRIMARY KEY,
 settlement_kind text NOT NULL CHECK(settlement_kind IN ('commit','compensate')),
 projected_events integer NOT NULL DEFAULT 0 CHECK(projected_events>=0),
 revision_before bigint, revision_after bigint,
 settled_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(business_id,run_id),
 FOREIGN KEY(business_id,run_id) REFERENCES execution_run(business_id,id),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id),
 CHECK(revision_after>=revision_before)
);
CREATE TABLE commitment_reconciliation (
 business_id uuid NOT NULL, deal_id uuid NOT NULL, cash_event_id bigint NOT NULL PRIMARY KEY,
 original_action_id uuid NOT NULL, compensation_action_id uuid NOT NULL, run_id uuid NOT NULL,
 reconciled_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(business_id,cash_event_id),
 FOREIGN KEY(business_id,cash_event_id) REFERENCES cash_event(business_id,id),
 FOREIGN KEY(original_action_id) REFERENCES execution_action(id),
 FOREIGN KEY(compensation_action_id) REFERENCES execution_action(id),
 FOREIGN KEY(business_id,run_id) REFERENCES execution_run(business_id,id),
 FOREIGN KEY(business_id,deal_id) REFERENCES deal(business_id,id)
);
CREATE INDEX commitment_reconciliation_run_idx ON commitment_reconciliation(run_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['evaluation_projection','commitment_settlement','commitment_reconciliation'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id=(SELECT app_business_id())) WITH CHECK (business_id=(SELECT app_business_id()))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO orderfit_app',t);
  EXECUTE format('GRANT SELECT ON %I TO orderfit_readonly',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_change()',t);
  EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_change()',t);
 END LOOP;
END $$;

CREATE FUNCTION p6_reconciliation_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.execution_run r JOIN public.execution_action c ON c.run_id=r.id
   JOIN public.commitment_projection p ON p.action_id=NEW.original_action_id AND p.cash_event_id=NEW.cash_event_id
    AND p.business_id=NEW.business_id
   JOIN public.cash_event ce ON ce.id=NEW.cash_event_id AND ce.business_id=NEW.business_id
  WHERE r.id=NEW.run_id AND r.business_id=NEW.business_id AND r.deal_id=NEW.deal_id AND r.run_kind='compensate'
   AND r.status='running' AND c.id=NEW.compensation_action_id AND c.kind='cancellation'
   AND c.status IN ('sent','posted','accepted') AND c.payload->>'original_action_id'=NEW.original_action_id::text
   AND ce.voided_at IS NOT NULL) THEN
  RAISE EXCEPTION 'reconciliation must void a projection of the exact reversed action' USING ERRCODE='OF007'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_reconciliation_guard BEFORE INSERT ON commitment_reconciliation FOR EACH ROW EXECUTE FUNCTION p6_reconciliation_guard();

CREATE FUNCTION p6_settlement_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.execution_run; items integer; done integer; expected integer; n integer; before bigint; projections jsonb;
BEGIN
 SELECT * INTO r FROM public.execution_run WHERE id=NEW.run_id AND business_id=NEW.business_id AND deal_id=NEW.deal_id;
 IF NOT FOUND OR r.status<>'running' OR (NEW.settlement_kind='commit')<>(r.run_kind='commit_plan')
  OR (NEW.settlement_kind='compensate')<>(r.run_kind='compensate') THEN
  RAISE EXCEPTION 'settlement requires its running commit or compensation run' USING ERRCODE='OF007'; END IF;
 IF NOT EXISTS(SELECT FROM public.operation o WHERE o.id=r.operation_id AND o.status='running'
   AND o.actor_user_id=public.app_user_id() AND o.session_id=nullif(current_setting('app.session_id',true),'')::uuid) THEN
  RAISE EXCEPTION 'settlement requires the run''s current operation' USING ERRCODE='OF007'; END IF;
 SELECT count(*) INTO items FROM public.action_bundle_item WHERE bundle_id=r.bundle_id AND business_id=r.business_id;
 SELECT count(*) INTO done FROM public.execution_action WHERE run_id=r.id AND status IN ('sent','posted','accepted');
 IF items<>done THEN RAISE EXCEPTION 'every manifest item must complete before settlement' USING ERRCODE='OF007'; END IF;
 SELECT financial_revision INTO before FROM public.business WHERE id=r.business_id FOR UPDATE;
 IF NEW.settlement_kind='commit' THEN
  SELECT i.payload->'projections' INTO projections FROM public.action_bundle_item i
   WHERE i.bundle_id=r.bundle_id AND i.business_id=r.business_id AND i.kind='commitment';
  IF projections IS NULL OR NOT EXISTS(SELECT FROM public.commitment_gate g WHERE g.business_id=r.business_id AND g.run_id=r.id) THEN
   RAISE EXCEPTION 'commit settlement requires the gate and an engine-derived commitment item' USING ERRCODE='OF007'; END IF;
  expected:=jsonb_array_length(projections);
  SELECT count(*) INTO n FROM public.commitment_projection p JOIN public.execution_action x ON x.id=p.action_id
   WHERE x.run_id=r.id AND p.business_id=r.business_id;
  IF n<>expected OR EXISTS(SELECT FROM jsonb_array_elements(projections) e WHERE NOT EXISTS(
   SELECT FROM public.commitment_projection p JOIN public.execution_action x ON x.id=p.action_id AND x.run_id=r.id
    JOIN public.cash_event ce ON ce.id=p.cash_event_id AND ce.business_id=p.business_id
   WHERE x.item_key=e->>'attributed_item_key' AND p.original_obligation_id=e->>'original_obligation_id'
    AND ce.deal_id=r.deal_id AND ce.voided_at IS NULL AND ce.event_date=(e->>'event_date')::date
    AND ce.amount_minor=(e->>'amount_minor')::bigint AND ce.direction=e->>'direction' AND ce.kind=e->>'kind'
    AND ce.certainty=e->>'certainty')) THEN
   RAISE EXCEPTION 'commitment projection is incomplete or differs from the approved manifest' USING ERRCODE='OF007'; END IF;
 ELSE
  SELECT count(*) INTO n FROM public.commitment_reconciliation WHERE run_id=r.id;
  IF EXISTS(SELECT FROM public.execution_action c JOIN public.commitment_projection p
    ON p.action_id::text=c.payload->>'original_action_id' AND p.business_id=c.business_id
   JOIN public.cash_event ce ON ce.id=p.cash_event_id AND ce.business_id=p.business_id
   WHERE c.run_id=r.id AND c.kind='cancellation'
    AND (ce.voided_at IS NULL OR NOT EXISTS(SELECT FROM public.commitment_reconciliation z
     WHERE z.cash_event_id=ce.id AND z.run_id=r.id))) THEN
   RAISE EXCEPTION 'compensation must reconcile every projection of reversed actions' USING ERRCODE='OF007'; END IF;
 END IF;
 NEW.projected_events:=n; NEW.revision_before:=before; NEW.revision_after:=before;
 IF NEW.settlement_kind='commit' OR n>0 THEN
  -- Nested trigger depth keeps this single bump (foundation_business_version).
  UPDATE public.business SET financial_revision=financial_revision+1 WHERE id=r.business_id
  RETURNING financial_revision INTO NEW.revision_after;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_settlement_guard BEFORE INSERT ON commitment_settlement FOR EACH ROW EXECUTE FUNCTION p6_settlement_guard();

-- Projection/reconciliation rows cannot commit without their run's settlement.
CREATE FUNCTION p6_requires_settlement() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE rid uuid; BEGIN
 IF TG_TABLE_NAME='commitment_projection' THEN
  SELECT run_id INTO rid FROM public.execution_action WHERE id=NEW.action_id;
 ELSE rid:=NEW.run_id; END IF;
 IF NOT EXISTS(SELECT FROM public.commitment_settlement s WHERE s.run_id=rid) THEN
  RAISE EXCEPTION 'projection change requires its settlement' USING ERRCODE='OF007'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER p6_projection_settled AFTER INSERT ON commitment_projection
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION p6_requires_settlement();
CREATE CONSTRAINT TRIGGER p6_reconciliation_settled AFTER INSERT ON commitment_reconciliation
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION p6_requires_settlement();

REVOKE ALL ON FUNCTION p6_projection_write(jsonb,jsonb),p6_check_reversal(execution_action) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p6_projection_write(jsonb,jsonb),p6_check_reversal(execution_action) TO orderfit_app;
