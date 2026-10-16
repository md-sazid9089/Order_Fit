-- A session issued before a membership role change must not inherit the changed role.
-- Update only the membership already locked under the business lock. Updating every
-- target auth_session here would invert the API's session -> business lock ordering.
-- Existing sessions remain usable in other businesses; signin issues a fresh token.
ALTER TABLE membership ADD COLUMN auth_valid_after timestamptz NOT NULL DEFAULT '-infinity';

CREATE FUNCTION membership_authentication_cutoff() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF TG_OP='INSERT' THEN NEW.auth_valid_after:='-infinity';
 ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
  NEW.auth_valid_after:=greatest(clock_timestamp(),OLD.auth_valid_after+interval '1 microsecond');
 ELSE NEW.auth_valid_after:=OLD.auth_valid_after;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER membership_authentication_cutoff BEFORE INSERT OR UPDATE ON membership
 FOR EACH ROW EXECUTE FUNCTION membership_authentication_cutoff();

-- Narrow boolean: authenticated current actor/session/current business only, no raw tokens
-- or session rows returned. FORCE RLS and all existing grants remain in effect.
CREATE FUNCTION session_authority_current(p_session uuid,p_business uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.auth_session s JOIN public.membership m
  ON m.user_id=s.user_id AND m.business_id=p_business
  WHERE s.id=p_session AND s.user_id=public.app_user_id()
   AND p_business=public.app_business_id() AND m.revoked_at IS NULL
   AND s.created_at>=m.auth_valid_after AND s.revoked_at IS NULL
   AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes')
$$;
REVOKE ALL ON FUNCTION session_authority_current(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION session_authority_current(uuid,uuid) TO orderfit_app;

-- Apply the same cutoff to every worker context and the per-effect actor fence. Claims
-- may select a stale job, but it cannot read provider input, heartbeat or publish effects.
CREATE OR REPLACE FUNCTION operation_context(p_id uuid,p_token uuid)
RETURNS TABLE(business_id uuid,user_id uuid,session_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT o.business_id,o.actor_user_id,o.session_id FROM public.operation o
 JOIN public.membership m ON m.business_id=o.business_id AND m.user_id=o.actor_user_id
 JOIN public.auth_session s ON s.id=o.session_id AND s.user_id=o.actor_user_id
 JOIN public.app_user u ON u.id=o.actor_user_id JOIN public.business b ON b.id=o.business_id
 WHERE o.id=p_id AND o.lease_token=p_token AND o.status='running' AND o.lease_expires_at>clock_timestamp()
 AND NOT o.cancellation_requested AND m.revoked_at IS NULL AND m.role IN ('commercial_lead','risk_officer','owner')
 AND s.created_at>=m.auth_valid_after AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
 AND s.last_active_at>clock_timestamp()-interval '30 minutes'
 AND u.status='active' AND NOT u.mfa_enforced AND b.status='active'
$$;

CREATE OR REPLACE FUNCTION operation_settle_context(p_id uuid,p_token uuid)
RETURNS TABLE(business_id uuid,user_id uuid,session_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT o.business_id,o.actor_user_id,o.session_id FROM public.operation o
 JOIN public.membership m ON m.business_id=o.business_id AND m.user_id=o.actor_user_id
 JOIN public.auth_session s ON s.id=o.session_id AND s.user_id=o.actor_user_id
 JOIN public.app_user u ON u.id=o.actor_user_id JOIN public.business b ON b.id=o.business_id
 WHERE o.id=p_id AND o.kind='execute' AND o.lease_token=p_token AND o.status='running'
 AND o.lease_expires_at>clock_timestamp()
 AND m.revoked_at IS NULL AND m.role IN ('commercial_lead','risk_officer','owner')
 AND s.created_at>=m.auth_valid_after AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
 AND s.last_active_at>clock_timestamp()-interval '30 minutes'
 AND u.status='active' AND NOT u.mfa_enforced AND b.status='active'
$$;

CREATE OR REPLACE FUNCTION p6_run_actor_current(p_op uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.operation o JOIN public.auth_session s ON s.id=o.session_id AND s.user_id=o.actor_user_id
  JOIN public.membership m ON m.user_id=o.actor_user_id AND m.business_id=o.business_id
  JOIN public.app_user u ON u.id=o.actor_user_id
  WHERE o.id=p_op AND o.business_id=public.app_business_id() AND o.kind='execute' AND o.status='running'
   AND NOT o.cancellation_requested AND o.lease_expires_at>clock_timestamp()
   AND o.session_id=nullif(current_setting('app.session_id',true),'')::uuid AND o.actor_user_id=public.app_user_id()
   AND s.created_at>=m.auth_valid_after AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
   AND s.last_active_at>clock_timestamp()-interval '30 minutes'
   AND m.revoked_at IS NULL AND m.role IN ('risk_officer','owner') AND u.status='active' AND NOT u.mfa_enforced)
$$;

-- An old approval must not regain authority merely because its actor signs in again.
CREATE OR REPLACE FUNCTION p6_approval_unusable_reason(p_approval uuid) RETURNS text
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.approval; reason text;
BEGIN
 SELECT * INTO a FROM public.approval WHERE id=p_approval;
 IF NOT FOUND OR a.bundle_id IS NULL THEN RETURN 'APPROVAL_NOT_FOUND'; END IF;
 IF a.decision<>'approved' THEN RETURN 'REJECTED'; END IF;
 IF EXISTS(SELECT FROM public.approval_revocation r WHERE r.approval_id=a.id) THEN RETURN 'REVOKED'; END IF;
 IF a.expires_at IS NULL OR a.expires_at<=clock_timestamp() THEN RETURN 'APPROVAL_EXPIRED'; END IF;
 IF NOT EXISTS(SELECT FROM public.membership m JOIN public.app_user u ON u.id=m.user_id
  WHERE m.business_id=a.business_id AND m.user_id=a.approver_id AND m.revoked_at IS NULL
   AND m.role IN ('risk_officer','owner') AND u.status='active' AND a.created_at>=m.auth_valid_after)
 THEN RETURN 'APPROVER_NOT_CURRENT'; END IF;
 reason:=public.p6_bundle_unusable_reason(a.bundle_id);
 RETURN reason;
END $$;
