-- P7: membership/invitations, payee-account verification evidence, recipient notifications,
-- cash CSV exports, invoice import batches and a narrow readiness probe. Additive forward
-- repair; no existing row is rewritten.
--
-- Proven insufficiencies of 0001-0011 under the restricted runtime LOGIN (pre-migration probe,
-- disposable PG17, recorded in the P7 handoff; regressions in tests/db/test_p7_*.py):
-- 1. No membership_invitation table existed.
-- 2. A commercial_lead context could UPDATE its own membership to role='owner' and INSERT an
--    owner membership for another user: only 'superadmin' was refused (membership_guard).
-- 3. Any member could SELECT and UPDATE read_at of another member's notification row: the
--    notification policy was business-wide (DB-17).
-- 4. payee_bank_account accepted INSERT status='verified' attributed to another user, a
--    pending->verified UPDATE without any evidence, and revoked->pending reactivation.
-- 5. app_user.version could not be bumped by the runtime role (42501) and was not bumped by a
--    self-service profile edit, so profile writes had no optimistic version.
-- 6. The runtime role cannot see queue rows outside its tenant (correct), so readiness needs a
--    narrow aggregate-only helper rather than a broad SELECT grant.

-- ---------------------------------------------------------------- 1. invitations
CREATE TABLE membership_invitation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES business(id),
 email text NOT NULL CHECK(email=lower(btrim(email)) AND position('@' IN email)>1 AND length(email)<=254),
 role text NOT NULL REFERENCES app_role(code)
  CHECK(role IN ('viewer','auditor','commercial_lead','risk_officer','owner')),
 token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
 invited_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz, accepted_by uuid REFERENCES app_user(id),
 revoked_at timestamptz, revoked_by uuid,
 revoke_reason text CHECK(revoke_reason IS NULL OR length(btrim(revoke_reason)) BETWEEN 1 AND 2000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(business_id,id),
 FOREIGN KEY(invited_by,business_id) REFERENCES membership(user_id,business_id),
 FOREIGN KEY(revoked_by,business_id) REFERENCES membership(user_id,business_id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days'),
 CHECK((accepted_at IS NULL)=(accepted_by IS NULL)),
 CHECK((revoked_at IS NULL)=(revoked_by IS NULL)),
 CHECK(accepted_at IS NULL OR revoked_at IS NULL)
);
-- One open invitation per business/email; an expired open row is revoked before reissue.
CREATE UNIQUE INDEX membership_invitation_open_uq ON membership_invitation(business_id,email)
 WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX membership_invitation_page ON membership_invitation(business_id,created_at,id);
ALTER TABLE membership_invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_invitation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON membership_invitation
 USING(business_id=(SELECT app_business_id())) WITH CHECK(business_id=(SELECT app_business_id()));
CREATE POLICY platform_admin ON membership_invitation TO orderfit_admin USING(true) WITH CHECK(true);
-- The narrow acceptance helper runs as owner and must find a token before a tenant is known.
DO $$ BEGIN
 EXECUTE format('CREATE POLICY invitation_owner ON membership_invitation TO %I USING(true) WITH CHECK(true)', current_user);
END $$;
REVOKE ALL ON membership_invitation FROM orderfit_app, orderfit_readonly;
GRANT SELECT(id,business_id,email,role,invited_by,created_at,expires_at,accepted_at,accepted_by,revoked_at,revoked_by,revoke_reason,version)
 ON membership_invitation TO orderfit_app;
GRANT INSERT ON membership_invitation TO orderfit_app;
GRANT UPDATE(revoked_at,revoked_by,revoke_reason,version) ON membership_invitation TO orderfit_app;
CREATE TRIGGER membership_invitation_no_delete BEFORE DELETE ON membership_invitation
 FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER membership_invitation_no_truncate BEFORE TRUNCATE ON membership_invitation
 FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

CREATE FUNCTION p7_active_owner(p_business uuid, p_user uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
  WHERE m.business_id=p_business AND m.user_id=p_user AND m.role='owner' AND m.revoked_at IS NULL
   AND u.status='active')
$$;

CREATE FUNCTION p7_invitation_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT public.app_is_restricted() THEN
  IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.invited_by IS DISTINCT FROM public.app_user_id() OR NOT public.p7_active_owner(NEW.business_id,NEW.invited_by)
   OR NEW.accepted_at IS NOT NULL OR NEW.revoked_at IS NOT NULL OR NEW.version<>1 THEN
   RAISE EXCEPTION 'invitation requires a current owner issuer' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 -- Restricted updates: only revoke an open invitation, as a current owner.
 IF (NEW.id,NEW.business_id,NEW.email,NEW.role,NEW.token_digest,NEW.invited_by,NEW.created_at,NEW.expires_at,NEW.accepted_at,NEW.accepted_by)
    IS DISTINCT FROM (OLD.id,OLD.business_id,OLD.email,OLD.role,OLD.token_digest,OLD.invited_by,OLD.created_at,OLD.expires_at,OLD.accepted_at,OLD.accepted_by)
  OR OLD.accepted_at IS NOT NULL OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
  OR NEW.revoked_by IS DISTINCT FROM public.app_user_id() OR NOT public.p7_active_owner(NEW.business_id,NEW.revoked_by) THEN
  RAISE EXCEPTION 'invitation history is immutable' USING ERRCODE='OF010'; END IF;
 NEW.version:=OLD.version+1;
 RETURN NEW;
END $$;
CREATE TRIGGER p7_invitation_guard BEFORE INSERT OR UPDATE ON membership_invitation
 FOR EACH ROW EXECUTE FUNCTION p7_invitation_guard();

-- ---------------------------------------------------------------- 2. membership actor
-- Restricted membership writes require a current owner actor; reinstating a revoked member is
-- only possible through invitation acceptance (owner-run helper below).
CREATE FUNCTION p7_membership_actor_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT public.app_is_restricted() THEN RETURN NEW; END IF;
 IF NOT public.p7_active_owner(NEW.business_id, public.app_user_id()) THEN
  RAISE EXCEPTION 'membership changes require a current owner' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' AND NEW.revoked_at IS NOT NULL THEN
  RAISE EXCEPTION 'membership starts active' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
  RAISE EXCEPTION 'revoked membership is reinstated only by invitation' USING ERRCODE='OF010'; END IF;
 IF TG_OP='UPDATE' AND OLD.revoked_at IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
  RAISE EXCEPTION 'revoked membership is immutable' USING ERRCODE='OF010'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p7_membership_actor BEFORE INSERT OR UPDATE ON membership
 FOR EACH ROW EXECUTE FUNCTION p7_membership_actor_guard();
CREATE INDEX IF NOT EXISTS membership_page ON membership(business_id,created_at,user_id);

-- Signed-in, matching-email acceptance. Every failure returns no row (no oracle on email,
-- business or token state). The caller's session must be current in this transaction.
CREATE FUNCTION invitation_accept(p_digest bytea) RETURNS TABLE(business_id uuid, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
#variable_conflict use_column
DECLARE inv public.membership_invitation; uid uuid:=public.app_user_id(); em text; existing public.membership;
 oldb text:=current_setting('app.business_id',true); BEGIN
 IF uid IS NULL OR p_digest IS NULL OR octet_length(p_digest)<>32 THEN RETURN; END IF;
 IF NOT EXISTS(SELECT FROM public.auth_session s WHERE s.id=nullif(current_setting('app.session_id',true),'')::uuid
   AND s.user_id=uid AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
   AND s.last_active_at>clock_timestamp()-interval '30 minutes') THEN RETURN; END IF;
 SELECT u.email INTO em FROM public.app_user u WHERE u.id=uid AND u.status='active' AND NOT u.mfa_enforced;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO inv FROM public.membership_invitation i WHERE i.token_digest=p_digest;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM set_config('app.business_id',inv.business_id::text,true);
 -- Lock order: business, then invitation, then membership.
 PERFORM 1 FROM public.business b WHERE b.id=inv.business_id AND b.status='active' FOR UPDATE;
 IF NOT FOUND THEN PERFORM set_config('app.business_id',coalesce(oldb,''),true); RETURN; END IF;
 SELECT * INTO inv FROM public.membership_invitation i WHERE i.id=inv.id FOR UPDATE;
 IF inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL OR inv.expires_at<=clock_timestamp() OR inv.email<>em THEN
  PERFORM set_config('app.business_id',coalesce(oldb,''),true); RETURN; END IF;
 SELECT * INTO existing FROM public.membership m WHERE m.user_id=uid AND m.business_id=inv.business_id FOR UPDATE;
 IF FOUND AND existing.revoked_at IS NULL THEN
  PERFORM set_config('app.business_id',coalesce(oldb,''),true); RETURN; END IF;
 IF FOUND THEN
  UPDATE public.membership m SET revoked_at=NULL, role=inv.role WHERE m.user_id=uid AND m.business_id=inv.business_id;
 ELSE
  INSERT INTO public.membership(user_id,business_id,role) VALUES(uid,inv.business_id,inv.role);
 END IF;
 UPDATE public.membership_invitation i SET accepted_at=clock_timestamp(), accepted_by=uid WHERE i.id=inv.id;
 INSERT INTO public.operation_log(business_id,actor,actor_user_id,tier,action,outcome,payload)
 VALUES(inv.business_id,'system',uid,(SELECT r.tier FROM public.app_role r WHERE r.code=inv.role),
  'invitation_accept','completed',jsonb_build_object('invitation_id',inv.id,'role',inv.role));
 PERFORM set_config('app.business_id',coalesce(oldb,''),true);
 RETURN QUERY SELECT inv.business_id, inv.role;
END $$;
REVOKE ALL ON FUNCTION invitation_accept(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invitation_accept(bytea) TO orderfit_app;

-- ---------------------------------------------------------------- 3. recipient notifications
ALTER TABLE notification ADD COLUMN event_key text
 CHECK(event_key IS NULL OR length(event_key) BETWEEN 1 AND 200);
CREATE UNIQUE INDEX notification_event_uq ON notification(business_id,user_id,event_key)
 WHERE event_key IS NOT NULL;
CREATE INDEX notification_own_page ON notification(business_id,user_id,created_at DESC,id DESC);
-- Legacy broadcast rows (user_id NULL) shared one read_at; they stay untouched but are no
-- longer readable through the runtime role.
DROP POLICY tenant_isolation ON notification;
CREATE POLICY notification_own_read ON notification FOR SELECT
 USING(business_id=(SELECT app_business_id()) AND user_id=(SELECT app_user_id()));
CREATE POLICY notification_own_update ON notification FOR UPDATE
 USING(business_id=(SELECT app_business_id()) AND user_id=(SELECT app_user_id()))
 WITH CHECK(business_id=(SELECT app_business_id()) AND user_id=(SELECT app_user_id()));
CREATE POLICY notification_tenant_insert ON notification FOR INSERT
 WITH CHECK(business_id=(SELECT app_business_id()) AND user_id IS NOT NULL);
CREATE FUNCTION p7_notification_read_once() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 -- First read wins; a read row cannot be marked unread or re-dated.
 IF OLD.read_at IS NOT NULL THEN NEW.read_at:=OLD.read_at; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p7_notification_read_once BEFORE UPDATE ON notification
 FOR EACH ROW EXECUTE FUNCTION p7_notification_read_once();

-- One row per intended active recipient, deduplicated per event; generated inside the
-- transaction that records the event. Respects the recipient's in-app preference.
CREATE FUNCTION p7_notify(p_business uuid, p_deal uuid, p_roles text[], p_exclude uuid,
 p_severity text, p_code text, p_title text, p_message text, p_url text, p_key text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 INSERT INTO public.notification(business_id,user_id,deal_id,severity,code,title,message,action_url,event_key)
 SELECT m.business_id,m.user_id,p_deal,p_severity,p_code,p_title,p_message,p_url,p_key
 FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
 WHERE m.business_id=p_business AND m.revoked_at IS NULL AND m.role=ANY(p_roles) AND u.status='active'
  AND m.user_id IS DISTINCT FROM p_exclude
  AND coalesce(u.preferences->>'in_app_notifications','true')<>'false'
 ON CONFLICT (business_id,user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING
$$;
REVOKE ALL ON FUNCTION p7_notify(uuid,uuid,text[],uuid,text,text,text,text,text,text) FROM PUBLIC;

CREATE FUNCTION p7_event_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE prep text[]:=ARRAY['commercial_lead','risk_officer','owner']; t3 text[]:=ARRAY['risk_officer','owner'];
 actor uuid:=public.app_user_id(); b public.action_bundle; BEGIN
 IF TG_TABLE_NAME='action_bundle' THEN
  PERFORM public.p7_notify(NEW.business_id,NEW.deal_id,t3,NEW.created_by,'warning','APPROVAL-REQUESTED',
   'Approval requested','A sandbox '||replace(NEW.action,'_',' ')||' bundle awaits approval.',
   '/deals/'||NEW.deal_id||'/negotiate','approval-requested:'||NEW.id);
 ELSIF TG_TABLE_NAME='approval' THEN
  IF NEW.bundle_id IS NOT NULL THEN
   PERFORM public.p7_notify(NEW.business_id,NEW.deal_id,prep,NEW.approver_id,
    CASE WHEN NEW.decision='approved' THEN 'info' ELSE 'warning' END,
    CASE WHEN NEW.decision='approved' THEN 'APPROVAL-GRANTED' ELSE 'APPROVAL-REJECTED' END,
    CASE WHEN NEW.decision='approved' THEN 'Approval granted' ELSE 'Approval rejected' END,
    'A sandbox '||replace(NEW.action,'_',' ')||' bundle was '||CASE WHEN NEW.decision='approved' THEN 'approved.' ELSE 'rejected.' END,
    '/deals/'||NEW.deal_id||'/negotiate','approval:'||NEW.id);
  END IF;
 ELSIF TG_TABLE_NAME='approval_revocation' THEN
  PERFORM public.p7_notify(NEW.business_id,NEW.deal_id,prep,NEW.actor_user_id,'warning','APPROVAL-REVOKED',
   'Approval revoked','An approval was revoked; remaining sandbox effects will not run.',
   '/deals/'||NEW.deal_id||'/negotiate','approval-revoked:'||NEW.approval_id);
 ELSIF TG_TABLE_NAME='execution_run' THEN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('succeeded','partial','failed') THEN
   PERFORM public.p7_notify(NEW.business_id,NEW.deal_id,prep,NULL,
    CASE NEW.status WHEN 'succeeded' THEN 'info' WHEN 'partial' THEN 'warning' ELSE 'critical' END,
    'EXECUTION-'||upper(NEW.status),
    'Sandbox execution '||NEW.status,
    'A sandbox '||replace(NEW.run_kind,'_',' ')||' run is '||NEW.status||'. No real message or payment was sent.',
    '/deals/'||NEW.deal_id,'execution:'||NEW.id||':'||NEW.status);
  END IF;
 ELSIF TG_TABLE_NAME='negotiation_message' THEN
  IF NEW.direction='inbound' THEN
   PERFORM public.p7_notify(NEW.business_id,NEW.deal_id,prep,coalesce(NEW.created_by,actor),'info','REPLY-RECEIVED',
    'Reply received','A counterparty reply was recorded and awaits review.',
    '/deals/'||NEW.deal_id||'/reply','reply:'||NEW.id);
  END IF;
 ELSIF TG_TABLE_NAME='deal_flag' THEN
  IF NEW.blocking AND NEW.code IN ('MANUAL-HOLD','P5-BANK-CHANGE') THEN
   PERFORM public.p7_notify(NEW.business_id,NEW.deal_id,prep,actor,
    CASE WHEN NEW.code='P5-BANK-CHANGE' THEN 'critical' ELSE 'warning' END,'HOLD-RAISED',
    CASE WHEN NEW.code='P5-BANK-CHANGE' THEN 'Bank change hold' ELSE 'Order on hold' END,
    CASE WHEN NEW.code='P5-BANK-CHANGE' THEN 'A reply changed bank details; dispatch is blocked until verified.'
     ELSE 'An order was placed on hold.' END,
    '/deals/'||NEW.deal_id,'hold:'||NEW.id);
  END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION p7_event_notification() FROM PUBLIC;
CREATE TRIGGER p7_notify_bundle AFTER INSERT ON action_bundle FOR EACH ROW EXECUTE FUNCTION p7_event_notification();
CREATE TRIGGER p7_notify_approval AFTER INSERT ON approval FOR EACH ROW EXECUTE FUNCTION p7_event_notification();
CREATE TRIGGER p7_notify_revocation AFTER INSERT ON approval_revocation FOR EACH ROW EXECUTE FUNCTION p7_event_notification();
CREATE TRIGGER p7_notify_execution AFTER UPDATE OF status ON execution_run FOR EACH ROW EXECUTE FUNCTION p7_event_notification();
CREATE TRIGGER p7_notify_reply AFTER INSERT ON negotiation_message FOR EACH ROW EXECUTE FUNCTION p7_event_notification();
CREATE TRIGGER p7_notify_hold AFTER INSERT ON deal_flag FOR EACH ROW EXECUTE FUNCTION p7_event_notification();

-- ---------------------------------------------------------------- 4. payee account evidence
-- NULL key version = legacy row whose fingerprint key version was never recorded.
ALTER TABLE payee_bank_account ADD COLUMN fingerprint_key_version integer
 CHECK(fingerprint_key_version IS NULL OR fingerprint_key_version>0);
CREATE INDEX payee_bank_account_page ON payee_bank_account(business_id,payee_id,created_at,id);
CREATE TABLE payee_account_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL, payee_id uuid NOT NULL, account_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('verification','revocation')),
 evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
 evidence_hash bytea NOT NULL CHECK(octet_length(evidence_hash)=32),
 account_fingerprint bytea NOT NULL CHECK(octet_length(account_fingerprint)=32),
 actor_user_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(account_id,kind),
 FOREIGN KEY(business_id,account_id) REFERENCES payee_bank_account(business_id,id),
 FOREIGN KEY(business_id,payee_id) REFERENCES payee(business_id,id),
 FOREIGN KEY(actor_user_id,business_id) REFERENCES membership(user_id,business_id)
);
ALTER TABLE payee_account_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE payee_account_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payee_account_evidence
 USING(business_id=(SELECT app_business_id())) WITH CHECK(business_id=(SELECT app_business_id()));
CREATE POLICY platform_admin ON payee_account_evidence TO orderfit_admin USING(true) WITH CHECK(true);
REVOKE ALL ON payee_account_evidence FROM orderfit_app, orderfit_readonly;
GRANT SELECT,INSERT ON payee_account_evidence TO orderfit_app;
GRANT SELECT ON payee_account_evidence TO orderfit_readonly;
CREATE TRIGGER payee_account_evidence_immutable BEFORE UPDATE OR DELETE ON payee_account_evidence
 FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER payee_account_evidence_no_truncate BEFORE TRUNCATE ON payee_account_evidence
 FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

CREATE FUNCTION p7_account_evidence_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.payee_bank_account a WHERE a.id=NEW.account_id AND a.business_id=NEW.business_id
   AND a.payee_id=NEW.payee_id AND a.account_fingerprint=NEW.account_fingerprint) THEN
  RAISE EXCEPTION 'evidence must name the exact account' USING ERRCODE='23514'; END IF;
 IF public.app_is_restricted() AND (NEW.actor_user_id IS DISTINCT FROM public.app_user_id() OR NOT EXISTS(
   SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
   WHERE m.business_id=NEW.business_id AND m.user_id=NEW.actor_user_id AND m.revoked_at IS NULL
    AND m.role IN ('risk_officer','owner') AND u.status='active')) THEN
  RAISE EXCEPTION 'account evidence requires a current finance manager' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p7_account_evidence_guard BEFORE INSERT ON payee_account_evidence
 FOR EACH ROW EXECUTE FUNCTION p7_account_evidence_guard();

CREATE FUNCTION p7_account_status_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT public.app_is_restricted() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'pending' OR NEW.verified_by IS NOT NULL OR NEW.verified_at IS NOT NULL
   OR NEW.fingerprint_key_version IS NULL THEN
   RAISE EXCEPTION 'accounts start pending with a recorded fingerprint key version' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF (NEW.payee_id,NEW.account_fingerprint,NEW.last4,NEW.bank_name,NEW.fingerprint_key_version,NEW.created_at)
    IS DISTINCT FROM (OLD.payee_id,OLD.account_fingerprint,OLD.last4,OLD.bank_name,OLD.fingerprint_key_version,OLD.created_at) THEN
  RAISE EXCEPTION 'account identity is immutable' USING ERRCODE='OF010'; END IF;
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
  IF (NEW.verified_by,NEW.verified_at) IS DISTINCT FROM (OLD.verified_by,OLD.verified_at) THEN
   RAISE EXCEPTION 'verification evidence is immutable' USING ERRCODE='OF010'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.status='pending' AND NEW.status='verified' THEN
  IF NEW.verified_by IS DISTINCT FROM public.app_user_id() OR NOT EXISTS(
    SELECT FROM public.payee_account_evidence e WHERE e.account_id=NEW.id AND e.business_id=NEW.business_id
     AND e.kind='verification' AND e.actor_user_id=NEW.verified_by AND e.account_fingerprint=NEW.account_fingerprint) THEN
   RAISE EXCEPTION 'verification requires recorded evidence by the verifier' USING ERRCODE='OF002'; END IF;
 ELSIF OLD.status IN ('pending','verified') AND NEW.status='revoked' THEN
  IF (NEW.verified_by,NEW.verified_at) IS DISTINCT FROM (OLD.verified_by,OLD.verified_at) OR NOT EXISTS(
    SELECT FROM public.payee_account_evidence e WHERE e.account_id=NEW.id AND e.business_id=NEW.business_id
     AND e.kind='revocation' AND e.actor_user_id=public.app_user_id()) THEN
   RAISE EXCEPTION 'revocation requires recorded evidence' USING ERRCODE='OF002'; END IF;
 ELSE
  RAISE EXCEPTION 'illegal account verification transition' USING ERRCODE='OF001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p7_account_status_guard BEFORE INSERT OR UPDATE ON payee_bank_account
 FOR EACH ROW EXECUTE FUNCTION p7_account_status_guard();

-- ---------------------------------------------------------------- 5. self profile version
CREATE FUNCTION p7_app_user_version() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF (NEW.full_name,NEW.preferences,NEW.email) IS DISTINCT FROM (OLD.full_name,OLD.preferences,OLD.email)
  AND NEW.version=OLD.version THEN NEW.version:=OLD.version+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p7_app_user_version BEFORE UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION p7_app_user_version();

-- ---------------------------------------------------------------- 6. cash CSV exports
CREATE TABLE cash_export (
 id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES business(id),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL, financial_revision bigint NOT NULL CHECK(financial_revision>0),
 row_count integer NOT NULL CHECK(row_count>=0),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 26214400),
 content_hash bytea NOT NULL CHECK(octet_length(content_hash)=32 AND sha256(content)=content_hash),
 UNIQUE(business_id,id),
 FOREIGN KEY(created_by,business_id) REFERENCES membership(user_id,business_id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours')
);
ALTER TABLE cash_export ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_export FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cash_export
 USING(business_id=(SELECT app_business_id())) WITH CHECK(business_id=(SELECT app_business_id()));
CREATE POLICY platform_admin ON cash_export TO orderfit_admin USING(true) WITH CHECK(true);
REVOKE ALL ON cash_export FROM orderfit_app, orderfit_readonly;
GRANT SELECT,INSERT ON cash_export TO orderfit_app;
CREATE TRIGGER cash_export_immutable BEFORE UPDATE OR DELETE ON cash_export
 FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER cash_export_no_truncate BEFORE TRUNCATE ON cash_export
 FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
CREATE FUNCTION p7_cash_export_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF public.app_is_restricted() AND (NEW.created_by IS DISTINCT FROM public.app_user_id() OR NOT EXISTS(
  SELECT FROM public.membership m WHERE m.business_id=NEW.business_id AND m.user_id=NEW.created_by AND m.revoked_at IS NULL)) THEN
  RAISE EXCEPTION 'export actor mismatch' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p7_cash_export_guard BEFORE INSERT ON cash_export FOR EACH ROW EXECUTE FUNCTION p7_cash_export_guard();

-- ---------------------------------------------------------------- 7. invoice import batches
-- NULL = invoice recorded before batch attribution existed.
ALTER TABLE customer_invoice ADD COLUMN import_id uuid;
CREATE INDEX customer_invoice_page ON customer_invoice(business_id,customer_id,invoice_date DESC,id DESC);

-- ---------------------------------------------------------------- 8. readiness
-- Aggregate only: age in seconds of the oldest claimable job (no tenant data, no IDs).
CREATE FUNCTION p7_queue_backlog_seconds() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce(floor(extract(epoch FROM clock_timestamp()-min(o.available_at)))::integer,0)
 FROM public.operation o
 WHERE (o.status='queued' AND o.available_at<=clock_timestamp())
    OR (o.status='running' AND o.lease_expires_at<=clock_timestamp())
$$;
REVOKE ALL ON FUNCTION p7_queue_backlog_seconds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p7_queue_backlog_seconds() TO orderfit_app;

-- ---------------------------------------------------------------- 9. bank-change hold evidence
-- 0009's p6_bank_resolution_guard read auth_session as the invoker; the runtime role has no
-- access to it (42501, same defect 0011 item 6 repaired for execution), so no bank-change hold
-- could ever be cleared through the guarded path. Same predicate, via a narrow definer check of
-- the caller's own current session only.
CREATE FUNCTION p7_caller_session_current() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.auth_session s WHERE s.id=nullif(current_setting('app.session_id',true),'')::uuid
  AND s.user_id=public.app_user_id() AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
  AND s.last_active_at>clock_timestamp()-interval '30 minutes')
$$;
REVOKE ALL ON FUNCTION p7_caller_session_current() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p7_caller_session_current() TO orderfit_app;
CREATE OR REPLACE FUNCTION p6_bank_resolution_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.actor_user_id IS DISTINCT FROM public.app_user_id() OR NOT EXISTS(
  SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
  WHERE m.user_id=NEW.actor_user_id AND m.business_id=NEW.business_id AND m.revoked_at IS NULL
   AND m.role IN ('risk_officer','owner') AND u.status='active')
  OR NOT public.p7_caller_session_current()
  OR NOT EXISTS(SELECT FROM public.reply_candidate_set q WHERE q.id=NEW.source_reply_id
   AND q.business_id=NEW.business_id AND q.deal_id=NEW.deal_id
   AND (q.payload->>'bank_change')::boolean IS TRUE)
  OR NOT EXISTS(SELECT FROM public.payee_bank_account a WHERE a.id=NEW.account_id AND a.business_id=NEW.business_id
   AND a.status='verified' AND a.account_fingerprint=NEW.verified_fingerprint
   AND a.payee_id=(SELECT (q.payload->>'party_id')::uuid FROM public.reply_candidate_set q WHERE q.id=NEW.source_reply_id))
 THEN RAISE EXCEPTION 'bank resolution requires current T3 review of the exact bank-change reply and verified account' USING ERRCODE='OF002'; END IF;
 RETURN NEW;
END $$;
