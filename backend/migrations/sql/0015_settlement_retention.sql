-- Settlement after a late cancellation; idempotency-key retention (forward revision after
-- 0013_runtime_hardening).
--
-- 1. Idempotency keys. 0003 granted DELETE (and 0003's blanket UPDATE) on idempotency_key to
--    orderfit_app; only IdempotencyRepository.reserve() limited deletion to expired keys.
--    Deleting, or re-expiring, a live key lets a retried request perform its effect a second
--    time. The runtime role may now delete only expired keys (reserve()'s cleanup keeps
--    working) and may update only status/response (completion). Superusers/maintenance
--    logins are not restricted by the trigger.
-- 2. Cancellation is a request to stop REMAINING effects at a safe boundary (plan 9.2, 9.5,
--    operations contract: "cannot revoke an already completed side effect"). operation_context()
--    refuses a cancellation-requested operation, so a cancellation that arrived after every
--    item of an execution run had committed made the settlement transaction fail, the
--    operation end 'cancelled' and the run 'partial' + reconciliation_required with the
--    commitment gate held, although every approved effect had been delivered.
--    operation_settle_context() is the same lease/authorization predicate without the
--    cancellation condition, for execute operations only; the worker uses it solely for the
--    settlement transaction, which itself refuses to run while any item is incomplete.
--    operation_finish() then records such an operation as finished (its run succeeded)
--    instead of 'cancelled'. Every other cancellation path is unchanged.

REVOKE UPDATE ON idempotency_key FROM orderfit_app;
GRANT UPDATE (status,response) ON idempotency_key TO orderfit_app;

CREATE FUNCTION idempotency_key_retention() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF OLD.expires_at>clock_timestamp() AND pg_has_role(current_user,'orderfit_app','MEMBER')
  AND NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN
  RAISE EXCEPTION 'an unexpired idempotency key cannot be deleted' USING ERRCODE='OF003';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER idempotency_key_retention BEFORE DELETE ON idempotency_key
 FOR EACH ROW EXECUTE FUNCTION idempotency_key_retention();

CREATE FUNCTION operation_settle_context(p_id uuid,p_token uuid) RETURNS TABLE(business_id uuid,user_id uuid,session_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT o.business_id,o.actor_user_id,o.session_id FROM public.operation o
 JOIN public.membership m ON m.business_id=o.business_id AND m.user_id=o.actor_user_id
 JOIN public.auth_session s ON s.id=o.session_id AND s.user_id=o.actor_user_id
 JOIN public.app_user u ON u.id=o.actor_user_id JOIN public.business b ON b.id=o.business_id
 WHERE o.id=p_id AND o.kind='execute' AND o.lease_token=p_token AND o.status='running'
 AND o.lease_expires_at>clock_timestamp()
 AND m.revoked_at IS NULL AND m.role IN ('commercial_lead','risk_officer','owner')
 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes'
 AND u.status='active' AND NOT u.mfa_enforced AND b.status='active'
$$;
REVOKE ALL ON FUNCTION operation_settle_context(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operation_settle_context(uuid,uuid) TO orderfit_worker;

-- 0011's operation_finish(), with one addition: an execute operation whose run already
-- succeeded (settled in this transaction) finishes normally although cancellation was
-- requested, because nothing remained to stop.
CREATE OR REPLACE FUNCTION operation_finish(p_id uuid,p_token uuid,p_result jsonb,p_retry boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE job public.operation; b public.business; d public.deal; oldb text; oldu text; late boolean; BEGIN
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
 late:=job.cancellation_requested AND job.kind='execute' AND p_result->>'kind'='completed'
  AND EXISTS(SELECT FROM public.execution_run r WHERE r.business_id=job.business_id AND r.operation_id=p_id AND r.status='succeeded')
  AND EXISTS(SELECT FROM public.operation_settle_context(p_id,p_token));
 IF job.cancellation_requested AND NOT late THEN
  UPDATE public.operation SET status='cancelled',subphase='cancelled',lease_token=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSIF NOT late AND NOT EXISTS(SELECT FROM public.operation_context(p_id,p_token)) THEN
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
 VALUES(job.business_id,job.deal_id,'system',job.actor_user_id,'operation_finish','completed',
  jsonb_build_object('operation_id',p_id)||CASE WHEN late THEN '{"cancellation_after_completion":true}'::jsonb ELSE '{}'::jsonb END);
 PERFORM set_config('app.business_id',coalesce(oldb,''),true),set_config('app.user_id',coalesce(oldu,''),true);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION operation_finish(uuid,uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operation_finish(uuid,uuid,jsonb,boolean) TO orderfit_worker;
