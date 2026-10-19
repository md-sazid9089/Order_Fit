-- Account-access.v1. Additive; no historical email ownership is inferred.
ALTER TABLE app_user ADD COLUMN email_verified_at timestamptz,
 ADD COLUMN verified_email text,
 ADD COLUMN credential_generation bigint NOT NULL DEFAULT 1 CHECK(credential_generation>0),
 ADD CONSTRAINT account_verified_email CHECK(
  (email_verified_at IS NULL AND verified_email IS NULL) OR
  (email_verified_at IS NOT NULL AND verified_email IS NOT NULL AND verified_email=email));
GRANT SELECT(email_verified_at,verified_email,credential_generation) ON app_user TO orderfit_app;
ALTER TABLE auth_session ADD COLUMN credential_generation bigint NOT NULL DEFAULT 1;

DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='orderfit_account_owner') THEN
  CREATE ROLE orderfit_account_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
 END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='orderfit_account_owner' AND
   (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
  RAISE EXCEPTION 'unsafe account helper role'; END IF;
 EXECUTE format('GRANT orderfit_account_owner TO %I',current_user);
END $$;
GRANT USAGE,CREATE ON SCHEMA public TO orderfit_account_owner;

CREATE TABLE account_access_token(
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_user(id),
 purpose text NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
 email text NOT NULL CHECK(email=lower(btrim(email))),
 credential_generation bigint NOT NULL CHECK(credential_generation>0),
 token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 consumed_at timestamptz, revoked_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+
   CASE WHEN purpose='reset_password' THEN interval '30 minutes' ELSE interval '24 hours' END)
);
CREATE UNIQUE INDEX account_access_live ON account_access_token(user_id,purpose)
 WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE TABLE account_mail_outbox(
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('verify_email','reset_password','password_changed','invitation')),
 user_id uuid REFERENCES app_user(id), business_id uuid,
 invitation_id uuid, token_id uuid REFERENCES account_access_token(id), credential_generation bigint,
 recipient_key bytea NOT NULL CHECK(octet_length(recipient_key)=32),
 key_id text NOT NULL CHECK(length(key_id) BETWEEN 1 AND 100),
 nonce bytea NOT NULL CHECK(octet_length(nonce)=12), ciphertext bytea,
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 template_version integer NOT NULL DEFAULT 1 CHECK(template_version=1),
 provider_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','delivered','failed','bounced','complained','unknown','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 first_attempt_at timestamptz,last_attempt_at timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_token uuid,lease_expires_at timestamptz,provider_email_id text UNIQUE,
 accepted_at timestamptz,delivered_at timestamptz,bounced_at timestamptz,complained_at timestamptz,
 cancelled_at timestamptz,failure_code text,
 FOREIGN KEY(business_id,invitation_id) REFERENCES membership_invitation(business_id,id),
 CHECK((kind='invitation' AND business_id IS NOT NULL AND invitation_id IS NOT NULL AND token_id IS NULL AND user_id IS NULL)
    OR (kind<>'invitation' AND business_id IS NULL AND invitation_id IS NULL AND user_id IS NOT NULL)),
 CHECK(kind NOT IN ('verify_email','reset_password') OR token_id IS NOT NULL),
 CHECK(kind<>'password_changed' OR (credential_generation IS NOT NULL AND credential_generation>0)),
 CHECK((lease_token IS NULL)=(lease_expires_at IS NULL)),
 CHECK(ciphertext IS NOT NULL OR status NOT IN ('queued','sending')),
 CHECK(expires_at>created_at)
);
CREATE UNIQUE INDEX account_mail_token ON account_mail_outbox(kind,token_id) WHERE token_id IS NOT NULL;
CREATE UNIQUE INDEX account_mail_invitation ON account_mail_outbox(kind,invitation_id) WHERE invitation_id IS NOT NULL;
CREATE UNIQUE INDEX account_mail_notice ON account_mail_outbox(kind,user_id,credential_generation) WHERE kind='password_changed';
CREATE INDEX account_mail_runnable ON account_mail_outbox(next_attempt_at,id) WHERE status='queued';
CREATE INDEX account_mail_lease ON account_mail_outbox(lease_expires_at,id) WHERE status='sending';
CREATE TABLE account_mail_event(
 event_id text PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 256),
 provider_email_id text NOT NULL CHECK(length(provider_email_id)<=256),
 event_type text NOT NULL CHECK(length(event_type)<=100),
 event_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 processed_at timestamptz
);
CREATE INDEX account_mail_event_pending ON account_mail_event(provider_email_id) WHERE processed_at IS NULL;
CREATE TABLE account_mail_suppression(
 recipient_key bytea PRIMARY KEY CHECK(octet_length(recipient_key)=32),
 cause text NOT NULL CHECK(cause IN ('bounce','complaint')),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['account_access_token','account_mail_outbox','account_mail_event','account_mail_suppression'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,orderfit_app,orderfit_readonly,orderfit_worker',t);
  EXECUTE format('CREATE POLICY account_helper ON %I TO orderfit_account_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY account_migrator ON %I TO %I USING(true) WITH CHECK(true)',t,current_user);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO orderfit_account_owner',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['app_user','auth_session','auth_passkey_challenge','step_up_grant','membership_invitation','membership','business'] LOOP
  EXECUTE format('CREATE POLICY account_helper ON %I TO orderfit_account_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
GRANT SELECT ON app_user,auth_session,auth_passkey_challenge,step_up_grant,membership_invitation,membership,business TO orderfit_account_owner;
GRANT INSERT ON app_user TO orderfit_account_owner;
GRANT UPDATE(password_hash,credential_generation,email_verified_at,verified_email,version) ON app_user TO orderfit_account_owner;
GRANT UPDATE(revoked_at,version) ON auth_session TO orderfit_account_owner;
GRANT UPDATE(consumed_at,completed_at) ON auth_passkey_challenge TO orderfit_account_owner;
GRANT UPDATE(id) ON membership_invitation TO orderfit_account_owner;
GRANT UPDATE(id) ON business TO orderfit_account_owner;
GRANT UPDATE(consumed_at) ON step_up_grant TO orderfit_account_owner;
GRANT INSERT ON security_event TO orderfit_account_owner;
GRANT USAGE ON SEQUENCE security_event_id_seq TO orderfit_account_owner;
GRANT EXECUTE ON FUNCTION auth_rate_consume(bytea,integer) TO orderfit_account_owner;
CREATE POLICY account_helper ON security_event FOR INSERT TO orderfit_account_owner WITH CHECK(true);

-- Invariant is enforced at SQL boundary even if a future caller forgets reset logic.
-- User->dependent locks use NOWAIT. A conflicting session->user transaction causes
-- a bounded retryable 55P03, never a deadlock cycle or partially applied reset.
CREATE FUNCTION account_credentials_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF (NEW.password_hash,NEW.email) IS DISTINCT FROM (OLD.password_hash,OLD.email) THEN
  PERFORM 1 FROM public.auth_session WHERE user_id=OLD.id AND revoked_at IS NULL ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.auth_passkey_challenge WHERE user_id=OLD.id ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.account_access_token WHERE user_id=OLD.id ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.step_up_grant WHERE user_id=OLD.id ORDER BY id FOR UPDATE NOWAIT;
  NEW.credential_generation:=OLD.credential_generation+1;
  UPDATE public.auth_session SET revoked_at=clock_timestamp(),version=version+1 WHERE user_id=OLD.id AND revoked_at IS NULL;
  UPDATE public.auth_passkey_challenge SET completed_at=clock_timestamp() WHERE user_id=OLD.id AND completed_at IS NULL;
  UPDATE public.account_access_token SET revoked_at=clock_timestamp() WHERE user_id=OLD.id AND consumed_at IS NULL AND revoked_at IS NULL;
  UPDATE public.step_up_grant SET consumed_at=coalesce(consumed_at,clock_timestamp()) WHERE user_id=OLD.id;
  IF NEW.email IS DISTINCT FROM OLD.email THEN NEW.verified_email:=NULL; NEW.email_verified_at:=NULL; END IF;
 ELSIF NEW.credential_generation<>OLD.credential_generation THEN
  RAISE EXCEPTION 'credential generation is maintained by credential writes' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION account_credentials_changed() OWNER TO orderfit_account_owner;
REVOKE ALL ON FUNCTION account_credentials_changed() FROM PUBLIC;
CREATE TRIGGER account_credentials_changed BEFORE UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION account_credentials_changed();

-- Session INSERT is serialized with the authoritative user row. Existing issuers
-- already hold that row and validate expected password hash; reset cannot miss a
-- concurrently issued old-credential session. Generation is defense in depth.
CREATE FUNCTION account_session_generation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 SELECT credential_generation INTO NEW.credential_generation FROM public.app_user WHERE id=NEW.user_id FOR SHARE;
 RETURN NEW;
END $$;
ALTER FUNCTION account_session_generation() OWNER TO orderfit_account_owner;
REVOKE ALL ON FUNCTION account_session_generation() FROM PUBLIC;
CREATE TRIGGER account_session_generation BEFORE INSERT ON auth_session FOR EACH ROW EXECUTE FUNCTION account_session_generation();

CREATE OR REPLACE FUNCTION session_resolve(p_digest bytea)
RETURNS TABLE(session_id uuid,user_id uuid,csrf_digest bytea,expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.auth_session s SET last_active_at=clock_timestamp() FROM public.app_user u
 WHERE s.token_digest=p_digest AND octet_length(p_digest)=32 AND s.user_id=u.id
 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes'
 AND s.credential_generation=u.credential_generation AND u.status='active' AND NOT u.mfa_enforced
 AND (NOT u.passkey_required OR s.mfa_verified_at IS NOT NULL)
 RETURNING s.id,s.user_id,s.csrf_digest,s.expires_at
$$;

CREATE FUNCTION account_access_lookup(p_email text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',id,'email',email,'generation',credential_generation,
  'eligible',status='active' AND NOT mfa_enforced AND password_hash IS NOT NULL
    AND verified_email=email AND email_verified_at IS NOT NULL)
 FROM public.app_user WHERE email=lower(btrim(p_email))
$$;
CREATE FUNCTION account_token_lookup(p_digest bytea,p_purpose text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',t.id,'user_id',t.user_id,'email',t.email,'generation',t.credential_generation)
 FROM public.account_access_token t WHERE t.token_digest=p_digest AND t.purpose=p_purpose
 AND t.consumed_at IS NULL AND t.revoked_at IS NULL AND t.expires_at>clock_timestamp()
$$;

CREATE FUNCTION account_mail_enqueue(p_kind text,p_user uuid,p_business uuid,p_invitation uuid,
 p_token uuid,p_generation bigint,p_expires timestamptz,p_mail jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE mid uuid:=(p_mail->>'id')::uuid; BEGIN
 IF p_kind='invitation' AND NOT EXISTS(SELECT FROM public.membership_invitation i
   WHERE i.id=p_invitation AND i.business_id=p_business AND i.invited_by=public.app_user_id()
   AND public.p7_active_owner(p_business,public.app_user_id()) AND i.revoked_at IS NULL AND i.accepted_at IS NULL) THEN
  RAISE EXCEPTION 'invitation mail requires owner' USING ERRCODE='42501'; END IF;
 INSERT INTO public.account_mail_outbox(id,kind,user_id,business_id,invitation_id,token_id,credential_generation,
  recipient_key,key_id,nonce,ciphertext,payload_hash,provider_key,expires_at)
 VALUES(mid,p_kind,p_user,p_business,p_invitation,p_token,p_generation,decode(p_mail->>'recipient_key','hex'),
  p_mail->>'key_id',decode(p_mail->>'nonce','hex'),decode(p_mail->>'ciphertext','hex'),decode(p_mail->>'payload_hash','hex'),
  'account-mail/'||mid::text,p_expires);
 RETURN mid;
END $$;

CREATE FUNCTION account_invitation_enqueue(p_business uuid,p_invitation uuid,p_mail jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE exp timestamptz; BEGIN
 SELECT expires_at INTO exp FROM public.membership_invitation WHERE id=p_invitation AND business_id=p_business;
 RETURN public.account_mail_enqueue('invitation',NULL,p_business,p_invitation,NULL,NULL,exp,p_mail);
END $$;

CREATE FUNCTION account_access_issue(p_user uuid,p_purpose text,p_email text,p_generation bigint,
 p_id uuid,p_digest bytea,p_session bytea,p_expected text,p_mail jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u public.app_user; exp timestamptz; BEGIN
 SELECT * INTO u FROM public.app_user WHERE id=p_user FOR UPDATE;
 IF NOT FOUND OR u.email<>p_email OR u.status<>'active' OR u.mfa_enforced OR u.password_hash IS NULL
  OR u.credential_generation<>p_generation THEN RETURN false; END IF;
 IF p_purpose='password_changed' THEN
  IF u.verified_email IS DISTINCT FROM u.email OR u.email_verified_at IS NULL
    OR u.password_hash IS DISTINCT FROM p_expected OR NOT EXISTS(SELECT FROM public.auth_session s
     WHERE s.token_digest=p_session AND s.user_id=u.id AND s.revoked_at>clock_timestamp()-interval '1 minute'
       AND s.credential_generation=u.credential_generation-1) THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT FROM public.account_mail_outbox WHERE kind='password_changed' AND user_id=u.id
      AND credential_generation=u.credential_generation) THEN
   PERFORM public.account_mail_enqueue('password_changed',u.id,NULL,NULL,NULL,u.credential_generation,
    clock_timestamp()+interval '23 hours',p_mail);
  END IF;
  RETURN true;
 END IF;
 IF p_purpose='verify_email' THEN
  IF u.password_hash IS DISTINCT FROM p_expected OR NOT EXISTS(SELECT FROM public.auth_session s WHERE s.user_id=u.id
   AND s.token_digest=p_session AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
   AND s.created_at>clock_timestamp()-interval '5 minutes'
   AND (NOT u.passkey_required OR s.mfa_verified_at>clock_timestamp()-interval '5 minutes')) THEN
    RAISE EXCEPTION 'fresh authentication required' USING ERRCODE='AC403'; END IF;
  exp:=clock_timestamp()+interval '24 hours';
 ELSIF p_purpose='reset_password' THEN
  IF u.email_verified_at IS NULL OR u.verified_email IS DISTINCT FROM u.email THEN RETURN false; END IF;
  exp:=clock_timestamp()+interval '30 minutes';
 ELSE RETURN false; END IF;
 IF EXISTS(SELECT FROM public.account_access_token WHERE user_id=u.id AND purpose=p_purpose
   AND created_at>clock_timestamp()-interval '60 seconds') THEN RETURN false; END IF;
 IF NOT public.auth_rate_consume(decode(p_mail->>'budget_key','hex'),3) THEN RETURN false; END IF;
 UPDATE public.account_access_token SET revoked_at=clock_timestamp() WHERE user_id=u.id AND purpose=p_purpose
  AND consumed_at IS NULL AND revoked_at IS NULL;
 INSERT INTO public.account_access_token(id,user_id,purpose,email,credential_generation,token_digest,expires_at)
  VALUES(p_id,u.id,p_purpose,u.email,u.credential_generation,p_digest,exp);
 PERFORM public.account_mail_enqueue(p_purpose,u.id,NULL,NULL,p_id,u.credential_generation,exp,p_mail);
 INSERT INTO public.security_event(user_id,code) VALUES(u.id,upper(p_purpose)||'_REQUESTED');
 RETURN true;
END $$;

CREATE FUNCTION account_access_confirm(p_digest bytea,p_purpose text,p_session bytea,p_new text,p_notice jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE t public.account_access_token; u public.app_user; BEGIN
 SELECT * INTO t FROM public.account_access_token WHERE token_digest=p_digest AND purpose=p_purpose;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO u FROM public.app_user WHERE id=t.user_id FOR UPDATE;
 SELECT * INTO t FROM public.account_access_token WHERE id=t.id FOR UPDATE NOWAIT;
 IF t.consumed_at IS NOT NULL OR t.revoked_at IS NOT NULL OR t.expires_at<=clock_timestamp()
   OR t.credential_generation<>u.credential_generation OR t.email<>u.email OR u.status<>'active' OR u.mfa_enforced THEN RETURN false; END IF;
 IF p_purpose='verify_email' THEN
  IF NOT EXISTS(SELECT FROM public.auth_session s WHERE s.user_id=u.id AND s.token_digest=p_session
   AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes'
   AND (NOT u.passkey_required OR s.mfa_verified_at IS NOT NULL)) THEN RETURN false; END IF;
  UPDATE public.app_user SET email_verified_at=clock_timestamp(),verified_email=email,version=version+1 WHERE id=u.id;
  UPDATE public.account_access_token SET revoked_at=clock_timestamp() WHERE user_id=u.id AND purpose='reset_password'
   AND consumed_at IS NULL AND revoked_at IS NULL;
 ELSIF p_purpose='reset_password' THEN
  IF u.email_verified_at IS NULL OR u.verified_email IS DISTINCT FROM u.email OR p_new IS NULL OR p_new NOT LIKE '$argon2id$%' THEN RETURN false; END IF;
  UPDATE public.app_user SET password_hash=p_new,version=version+1 WHERE id=u.id;
  PERFORM public.account_mail_enqueue('password_changed',u.id,NULL,NULL,NULL,u.credential_generation+1,
   clock_timestamp()+interval '23 hours',p_notice);
 ELSE RETURN false; END IF;
 UPDATE public.account_access_token SET consumed_at=clock_timestamp() WHERE id=t.id;
 INSERT INTO public.security_event(user_id,code) VALUES(u.id,upper(p_purpose)||'_COMPLETED');
 RETURN true;
END $$;

-- Token-only registration creates no business or membership. Invite remains unused.
CREATE FUNCTION account_invitation_register(p_digest bytea,p_name text,p_hash text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i public.membership_invitation; uid uuid; BEGIN
 SELECT * INTO i FROM public.membership_invitation WHERE token_digest=p_digest;
 IF NOT FOUND THEN RETURN 'invalid'; END IF;
 PERFORM 1 FROM public.business WHERE id=i.business_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'invalid'; END IF;
 SELECT * INTO i FROM public.membership_invitation WHERE id=i.id FOR UPDATE;
 IF i.accepted_at IS NOT NULL OR i.revoked_at IS NOT NULL OR i.expires_at<=clock_timestamp()
  OR NOT public.p7_active_owner(i.business_id,i.invited_by) THEN RETURN 'invalid'; END IF;
 IF p_hash IS NULL OR p_hash NOT LIKE '$argon2id$%' OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 2000 THEN RETURN 'invalid'; END IF;
 INSERT INTO public.app_user(email,full_name,password_hash,mfa_enforced,status,preferences)
 VALUES(i.email,p_name,p_hash,false,'active','{"timezone":"UTC","language":"en","in_app_notifications":true}')
 ON CONFLICT(email) DO NOTHING RETURNING id INTO uid;
 IF uid IS NULL THEN RETURN 'exists'; END IF;
 INSERT INTO public.security_event(user_id,code) VALUES(uid,'INVITATION_REGISTERED');
 RETURN 'created';
END $$;

-- Wrap the existing acceptance helper to add issuer authority without copying its
-- membership/audit/fencing semantics. The business lock serializes owner changes.
ALTER FUNCTION invitation_accept(bytea) RENAME TO invitation_accept_legacy;
REVOKE ALL ON FUNCTION invitation_accept_legacy(bytea) FROM orderfit_app,PUBLIC;
CREATE FUNCTION invitation_accept(p_digest bytea) RETURNS TABLE(business_id uuid,role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i public.membership_invitation; BEGIN
 SELECT * INTO i FROM public.membership_invitation WHERE token_digest=p_digest;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM 1 FROM public.business WHERE id=i.business_id AND status='active' FOR UPDATE;
 IF NOT FOUND OR NOT public.p7_active_owner(i.business_id,i.invited_by) THEN RETURN; END IF;
 RETURN QUERY SELECT * FROM public.invitation_accept_legacy(p_digest);
END $$;
REVOKE ALL ON FUNCTION invitation_accept(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invitation_accept(bytea) TO orderfit_app;

CREATE FUNCTION account_mail_delivery(p_business uuid,p_invitation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF public.app_business_id() IS DISTINCT FROM p_business OR NOT public.p7_active_owner(p_business,public.app_user_id()) THEN
  RAISE EXCEPTION 'owner required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('status',status,'attempts',attempts,'last_attempt_at',last_attempt_at,
  'accepted_at',accepted_at,'delivered_at',delivered_at,'failure_code',failure_code)
  FROM public.account_mail_outbox WHERE business_id=p_business AND invitation_id=p_invitation);
END $$;
CREATE FUNCTION account_mail_cancel(p_business uuid,p_invitation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF public.app_business_id() IS DISTINCT FROM p_business OR NOT public.p7_active_owner(p_business,public.app_user_id()) THEN
  RAISE EXCEPTION 'owner required' USING ERRCODE='42501'; END IF;
 UPDATE public.account_mail_outbox SET cancelled_at=clock_timestamp(),status='cancelled',ciphertext=NULL,
  failure_code='DELIVERY_CANCELLED',lease_token=NULL,lease_expires_at=NULL
 WHERE business_id=p_business AND invitation_id=p_invitation AND status='queued';
END $$;

-- Transfer only new helpers to a non-login, non-bypass role. Never grant that role
-- to runtime. Existing auth helpers keep their original reviewed owners.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('account_access_lookup','account_token_lookup','account_mail_enqueue','account_invitation_enqueue',
   'account_access_issue','account_access_confirm','account_invitation_register','account_mail_delivery','account_mail_cancel') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO orderfit_account_owner',f.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.sig);
  IF f.sig::text NOT LIKE 'account_mail_enqueue(%' THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO orderfit_app',f.sig);
  END IF;
 END LOOP;
END $$;
CREATE FUNCTION account_mail_reconcile(p_provider text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o public.account_mail_outbox; e public.account_mail_event; BEGIN
 SELECT * INTO o FROM public.account_mail_outbox WHERE provider_email_id=p_provider FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 FOR e IN SELECT * FROM public.account_mail_event WHERE provider_email_id=p_provider AND processed_at IS NULL ORDER BY event_at,event_id FOR UPDATE LOOP
  UPDATE public.account_mail_outbox SET
   accepted_at=CASE WHEN e.event_type IN ('email.sent','email.delivered','email.bounced','email.complained') THEN coalesce(accepted_at,e.event_at) ELSE accepted_at END,
   delivered_at=CASE WHEN e.event_type='email.delivered' THEN coalesce(delivered_at,e.event_at) ELSE delivered_at END,
   bounced_at=CASE WHEN e.event_type='email.bounced' THEN coalesce(bounced_at,e.event_at) ELSE bounced_at END,
   complained_at=CASE WHEN e.event_type='email.complained' THEN coalesce(complained_at,e.event_at) ELSE complained_at END
   WHERE id=o.id;
  IF e.event_type IN ('email.bounced','email.complained') THEN
   INSERT INTO public.account_mail_suppression(recipient_key,cause)
   VALUES(o.recipient_key,CASE WHEN e.event_type='email.complained' THEN 'complaint' ELSE 'bounce' END)
   ON CONFLICT(recipient_key) DO UPDATE SET cause=CASE WHEN excluded.cause='complaint' THEN 'complaint' ELSE account_mail_suppression.cause END;
  END IF;
  UPDATE public.account_mail_event SET processed_at=clock_timestamp() WHERE event_id=e.event_id;
 END LOOP;
 UPDATE public.account_mail_outbox SET status=CASE WHEN complained_at IS NOT NULL THEN 'complained'
  WHEN bounced_at IS NOT NULL THEN 'bounced' WHEN delivered_at IS NOT NULL THEN 'delivered'
  WHEN accepted_at IS NOT NULL THEN 'accepted' ELSE status END,
  ciphertext=CASE WHEN accepted_at IS NOT NULL THEN NULL ELSE ciphertext END,
  failure_code=CASE WHEN bounced_at IS NOT NULL OR complained_at IS NOT NULL THEN 'DELIVERY_SUPPRESSED' ELSE failure_code END
 WHERE id=o.id;
END $$;

CREATE FUNCTION account_mail_event_record(p_id text,p_provider text,p_type text,p_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 -- Serialize callback before/after send publication, including the no-row case.
 PERFORM pg_advisory_xact_lock(hashtextextended('account-mail:'||p_provider,0));
 INSERT INTO public.account_mail_event(event_id,provider_email_id,event_type,event_at)
 VALUES(p_id,p_provider,p_type,p_at) ON CONFLICT DO NOTHING;
 PERFORM public.account_mail_reconcile(p_provider);
END $$;

CREATE FUNCTION account_mail_valid(p_id uuid,p_fence uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.account_mail_outbox o WHERE o.id=p_id AND o.status='sending'
  AND o.lease_token=p_fence AND o.lease_expires_at>clock_timestamp() AND o.expires_at>clock_timestamp()
  AND o.cancelled_at IS NULL AND NOT EXISTS(SELECT FROM public.account_mail_suppression s WHERE s.recipient_key=o.recipient_key)
  AND (o.kind='password_changed' OR
   (o.kind IN ('verify_email','reset_password') AND EXISTS(SELECT FROM public.account_access_token t JOIN public.app_user u ON u.id=t.user_id
    WHERE t.id=o.token_id AND t.consumed_at IS NULL AND t.revoked_at IS NULL AND t.expires_at>clock_timestamp()
    AND t.credential_generation=u.credential_generation AND t.email=u.email AND u.status='active' AND NOT u.mfa_enforced)) OR
   (o.kind='invitation' AND EXISTS(SELECT FROM public.membership_invitation i JOIN public.business b ON b.id=i.business_id
    WHERE i.id=o.invitation_id AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>clock_timestamp()
    AND b.status='active' AND public.p7_active_owner(i.business_id,i.invited_by)))))
$$;

CREATE FUNCTION account_mail_claim() RETURNS SETOF account_mail_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE o public.account_mail_outbox; BEGIN
 SELECT * INTO o FROM public.account_mail_outbox
 WHERE (status='queued' AND next_attempt_at<=clock_timestamp()) OR (status='sending' AND lease_expires_at<=clock_timestamp())
 ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 IF o.expires_at<=clock_timestamp() OR o.attempts>=8 OR o.first_attempt_at<clock_timestamp()-interval '23 hours' THEN
  UPDATE public.account_mail_outbox SET status=CASE WHEN attempts>0 THEN 'unknown' ELSE 'cancelled' END,
   failure_code=CASE WHEN attempts>0 THEN 'DELIVERY_OUTCOME_UNKNOWN' ELSE 'DELIVERY_CANCELLED' END,
   ciphertext=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=o.id;
  RETURN;
 END IF;
 UPDATE public.account_mail_outbox SET status='sending',lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '60 seconds',
  attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),last_attempt_at=clock_timestamp()
 WHERE id=o.id RETURNING * INTO o;
 IF NOT public.account_mail_valid(o.id,o.lease_token) THEN
  UPDATE public.account_mail_outbox SET
   status=CASE WHEN EXISTS(SELECT FROM public.account_mail_suppression WHERE recipient_key=o.recipient_key) THEN 'failed' ELSE 'cancelled' END,
   failure_code=CASE WHEN EXISTS(SELECT FROM public.account_mail_suppression WHERE recipient_key=o.recipient_key) THEN 'DELIVERY_SUPPRESSED' ELSE 'DELIVERY_CANCELLED' END,
   cancelled_at=clock_timestamp(),
   ciphertext=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=o.id;
  RETURN;
 END IF;
 RETURN NEXT o;
END $$;

CREATE FUNCTION account_mail_publish(p_id uuid,p_fence uuid,p_status text,p_provider text,p_delay integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o public.account_mail_outbox; BEGIN
 IF p_status NOT IN ('accepted','retry','rejected','cancelled') OR p_delay NOT BETWEEN 1 AND 82800 THEN RETURN false; END IF;
 IF p_provider IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('account-mail:'||p_provider,0)); END IF;
 SELECT * INTO o FROM public.account_mail_outbox WHERE id=p_id AND lease_token=p_fence
  AND lease_expires_at>clock_timestamp() AND status='sending' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.account_mail_outbox SET provider_email_id=p_provider,
  accepted_at=CASE WHEN p_status='accepted' THEN clock_timestamp() ELSE accepted_at END,
  status=CASE p_status WHEN 'accepted' THEN 'accepted' WHEN 'retry' THEN 'queued' WHEN 'rejected' THEN 'failed' ELSE 'cancelled' END,
  failure_code=CASE p_status WHEN 'rejected' THEN 'DELIVERY_REJECTED' WHEN 'cancelled' THEN 'DELIVERY_CANCELLED' ELSE NULL END,
  ciphertext=CASE WHEN p_status='retry' THEN ciphertext ELSE NULL END,
  next_attempt_at=clock_timestamp()+make_interval(secs=>p_delay),lease_token=NULL,lease_expires_at=NULL WHERE id=o.id;
 IF p_provider IS NOT NULL THEN PERFORM public.account_mail_reconcile(p_provider); END IF;
 RETURN true;
END $$;

CREATE FUNCTION account_mail_maintenance() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 UPDATE public.account_mail_outbox SET status=CASE WHEN attempts>0 THEN 'unknown' ELSE 'cancelled' END,
  failure_code=CASE WHEN attempts>0 THEN 'DELIVERY_OUTCOME_UNKNOWN' ELSE 'DELIVERY_CANCELLED' END,
  ciphertext=NULL,lease_token=NULL,lease_expires_at=NULL WHERE status IN ('queued','sending')
  AND (expires_at<=clock_timestamp() OR first_attempt_at<clock_timestamp()-interval '23 hours')
  AND (lease_expires_at IS NULL OR lease_expires_at<=clock_timestamp());
 DELETE FROM public.account_mail_event WHERE received_at<clock_timestamp()-interval '90 days';
 DELETE FROM public.account_mail_outbox WHERE status NOT IN ('queued','sending') AND expires_at<clock_timestamp()-interval '90 days';
 DELETE FROM public.account_access_token t WHERE t.expires_at<clock_timestamp()-interval '90 days'
  AND NOT EXISTS(SELECT FROM public.account_mail_outbox o WHERE o.token_id=t.id);
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS sig,proname FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('account_mail_reconcile','account_mail_event_record','account_mail_valid','account_mail_claim','account_mail_publish','account_mail_maintenance') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO orderfit_account_owner',f.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.sig);
  IF f.proname='account_mail_event_record' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO orderfit_app',f.sig);
  ELSIF f.proname<>'account_mail_reconcile' AND f.proname<>'account_mail_maintenance' THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO orderfit_worker',f.sig);
  END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM orderfit_account_owner;
