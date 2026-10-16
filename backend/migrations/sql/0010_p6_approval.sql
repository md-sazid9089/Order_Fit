-- P6 exact-bundle approval repair. Additive; existing approvals/bundles are untouched.
-- 1. approval_guard locked action_bundle FOR SHARE, which needs UPDATE privilege the runtime
--    role deliberately lacks (bundles are immutable), so every bundle approval failed 42501.
-- 2. Bundle-backed send approvals bind the full bundle hash, not one legacy message pin.
-- 3. One SQL predicate states why a bundle/approval is unusable, for API reads and guards.
-- 4. step_up_grant lacked an INSERT grant (see below), so step-up could never be issued.

ALTER TABLE approval DROP CONSTRAINT approval_check3;
ALTER TABLE approval ADD CONSTRAINT approval_send_message_pin
 CHECK(action<>'send_message' OR bundle_id IS NOT NULL OR (message_id IS NOT NULL AND message_sha256 IS NOT NULL));
-- A bundle approval never pins a single message, so legacy message paths cannot reuse it.
ALTER TABLE approval ADD CONSTRAINT approval_bundle_no_message_pin
 CHECK(bundle_id IS NULL OR (message_id IS NULL AND message_sha256 IS NULL));

-- NULL means currently usable for its kind. Codes are stable API reason codes.
CREATE FUNCTION p6_bundle_unusable_reason(p_bundle uuid) RETURNS text LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b public.action_bundle; d public.deal; revision bigint; req jsonb; aid uuid;
BEGIN
 SELECT * INTO b FROM public.action_bundle WHERE id=p_bundle;
 IF NOT FOUND THEN RETURN 'BUNDLE_NOT_FOUND'; END IF;
 IF b.expires_at<=clock_timestamp() THEN RETURN 'BUNDLE_EXPIRED'; END IF;
 IF b.action='compensate' THEN RETURN NULL; END IF;
 SELECT * INTO d FROM public.deal WHERE business_id=b.business_id AND id=b.deal_id;
 SELECT financial_revision INTO revision FROM public.business WHERE id=b.business_id;
 IF d.input_version<>b.input_version THEN RETURN 'STALE_INPUT_VERSION'; END IF;
 IF revision<>b.financial_revision THEN RETURN 'STALE_FINANCIAL_REVISION'; END IF;
 IF EXISTS(SELECT FROM public.evaluation e WHERE e.id=b.evaluation_id AND e.superseded_at IS NOT NULL)
 THEN RETURN 'SUPERSEDED_EVALUATION'; END IF;
 IF d.status NOT IN ('awaiting_approval','awaiting_reply') THEN RETURN 'DEAL_STATE_CONFLICT'; END IF;
 IF EXISTS(SELECT FROM public.deal_flag f WHERE f.business_id=b.business_id AND f.deal_id=b.deal_id
  AND f.blocking AND f.resolved_at IS NULL) THEN RETURN 'UNRESOLVED_BLOCKERS'; END IF;
 -- Editing a prepared message creates a successor; the old content keeps no authority.
 IF EXISTS(SELECT FROM public.action_bundle_item i JOIN public.prepared_message p
   ON p.business_id=i.business_id AND p.previous_id=i.message_id
  WHERE i.bundle_id=b.id AND i.kind='message') THEN RETURN 'SUPERSEDED_MESSAGE'; END IF;
 FOR req IN SELECT value FROM jsonb_array_elements(coalesce(b.manifest->'required_acceptances','[]'::jsonb)) LOOP
  aid:=nullif(req->>'acceptance_id','')::uuid;
  IF aid IS NULL OR NOT EXISTS(SELECT FROM public.party_acceptance a WHERE a.id=aid
    AND a.business_id=b.business_id AND (a.payload->>'valid_until')::timestamptz>clock_timestamp())
   OR EXISTS(SELECT FROM public.party_acceptance s WHERE s.business_id=b.business_id AND s.supersedes_id=aid)
  THEN RETURN 'ACCEPTANCE_UNAVAILABLE'; END IF;
 END LOOP;
 RETURN NULL;
END $$;

CREATE FUNCTION p6_approval_unusable_reason(p_approval uuid) RETURNS text LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.approval; reason text;
BEGIN
 SELECT * INTO a FROM public.approval WHERE id=p_approval;
 IF NOT FOUND OR a.bundle_id IS NULL THEN RETURN 'APPROVAL_NOT_FOUND'; END IF;
 IF a.decision<>'approved' THEN RETURN 'REJECTED'; END IF;
 IF EXISTS(SELECT FROM public.approval_revocation r WHERE r.approval_id=a.id) THEN RETURN 'REVOKED'; END IF;
 IF a.expires_at IS NULL OR a.expires_at<=clock_timestamp() THEN RETURN 'APPROVAL_EXPIRED'; END IF;
 IF NOT EXISTS(SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
  WHERE m.business_id=a.business_id AND m.user_id=a.approver_id AND m.revoked_at IS NULL
   AND m.role IN ('risk_officer','owner') AND u.status='active') THEN RETURN 'APPROVER_NOT_CURRENT'; END IF;
 reason:=public.p6_bundle_unusable_reason(a.bundle_id);
 RETURN reason;
END $$;

-- Same contract as 0009 without row locks on immutable bundles; adds actor binding for
-- recorded rejections and the shared current-bundle predicate for approvals.
CREATE OR REPLACE FUNCTION approval_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tier text; b public.action_bundle; grant_row public.step_up_grant; legacy_message record; reason text;
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
 SELECT * INTO b FROM public.action_bundle WHERE business_id=NEW.business_id AND deal_id=NEW.deal_id AND id=NEW.bundle_id;
 IF NOT FOUND OR b.action IS DISTINCT FROM NEW.action OR b.bundle_hash IS DISTINCT FROM NEW.action_plan_hash THEN
  RAISE EXCEPTION 'approval does not match exact bundle' USING ERRCODE='OF005'; END IF;
 IF NEW.evaluation_id IS DISTINCT FROM b.evaluation_id OR NEW.option_key IS DISTINCT FROM b.option_key THEN
  RAISE EXCEPTION 'approval evaluation mismatch' USING ERRCODE='OF005'; END IF;
 IF NEW.approver_id IS DISTINCT FROM public.app_user_id() THEN RAISE EXCEPTION 'approval actor mismatch' USING ERRCODE='OF005'; END IF;
 SELECT r.tier INTO tier FROM public.membership m JOIN public.app_role r ON r.code=m.role
 WHERE m.business_id=NEW.business_id AND m.user_id=NEW.approver_id AND m.revoked_at IS NULL;
 IF tier IS NULL OR tier NOT IN ('T3','T4') OR NOT EXISTS(SELECT FROM public.app_user u WHERE u.id=NEW.approver_id AND u.status='active')
 THEN RAISE EXCEPTION 'current T3 membership required' USING ERRCODE='OF005'; END IF;
 IF NEW.decision='rejected' THEN RETURN NEW; END IF;
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
 reason:=public.p6_bundle_unusable_reason(b.id);
 IF reason IS NOT NULL THEN RAISE EXCEPTION 'bundle is stale or blocked' USING ERRCODE='OF005'; END IF;
 RETURN NEW;
END $$;

-- 4. Step-up issuance had SELECT/UPDATE(consumed_at) only, so no grant could ever be issued.
--    Grant INSERT narrowly and bind each new grant to the verified session, a current T3
--    member and the exact live bundle; the password check itself stays in the API.
CREATE FUNCTION p6_step_up_entry() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b public.action_bundle;
BEGIN
 SELECT * INTO b FROM public.action_bundle WHERE business_id=NEW.business_id AND id=NEW.bundle_id;
 IF NOT FOUND OR NEW.user_id IS DISTINCT FROM public.app_user_id()
  OR NEW.session_id IS DISTINCT FROM nullif(current_setting('app.session_id',true),'')::uuid
  OR NEW.purpose IS DISTINCT FROM b.action OR NEW.bundle_hash IS DISTINCT FROM b.bundle_hash
  OR NEW.consumed_at IS NOT NULL OR b.expires_at<=clock_timestamp() OR NEW.expires_at>b.expires_at
  OR NOT EXISTS(SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
   WHERE m.business_id=NEW.business_id AND m.user_id=NEW.user_id AND m.revoked_at IS NULL
    AND m.role IN ('risk_officer','owner') AND u.status='active' AND NOT u.mfa_enforced)
 THEN RAISE EXCEPTION 'invalid step-up grant' USING ERRCODE='OF005'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p6_step_up_entry BEFORE INSERT ON step_up_grant FOR EACH ROW EXECUTE FUNCTION p6_step_up_entry();
GRANT INSERT ON step_up_grant TO orderfit_app;

REVOKE ALL ON FUNCTION p6_bundle_unusable_reason(uuid),p6_approval_unusable_reason(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p6_bundle_unusable_reason(uuid),p6_approval_unusable_reason(uuid) TO orderfit_app;
