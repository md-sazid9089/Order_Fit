ALTER TABLE app_user ADD COLUMN passkey_required boolean NOT NULL DEFAULT false;
GRANT SELECT(passkey_required) ON app_user TO orderfit_app;
ALTER TABLE auth_session ADD COLUMN mfa_verified_at timestamptz;

CREATE TABLE auth_passkey (
 id bytea PRIMARY KEY CHECK(octet_length(id) BETWEEN 1 AND 2048),
 user_id uuid NOT NULL REFERENCES app_user(id),
 public_key bytea NOT NULL CHECK(octet_length(public_key) BETWEEN 1 AND 4096),
 sign_count bigint NOT NULL CHECK(sign_count>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX auth_passkey_user ON auth_passkey(user_id);
CREATE TABLE auth_passkey_challenge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user(id),
 purpose text NOT NULL CHECK(purpose IN ('enroll','login')),
 session_id uuid REFERENCES auth_session(id), csrf_digest bytea NOT NULL,
 password_hash text NOT NULL, challenge bytea NOT NULL CHECK(octet_length(challenge)=32),
 rp text NOT NULL, origin text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '5 minutes',
 consumed_at timestamptz, completed_at timestamptz
);
CREATE INDEX auth_passkey_challenge_user ON auth_passkey_challenge(user_id,expires_at);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['auth_passkey','auth_passkey_challenge'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY auth_owner ON %I TO %I USING(true) WITH CHECK(true)',t,current_user);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,orderfit_app,orderfit_readonly,orderfit_worker',t);
 END LOOP;
END $$;

-- Keep the password-only issuer closed for enabled accounts, even if application
-- code accidentally routes an MFA user through the legacy login command.
CREATE OR REPLACE FUNCTION session_issue(p_email text,p_expected_hash text,p_digest bytea,p_csrf bytea) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u public.app_user; sid uuid; BEGIN
 SELECT * INTO u FROM public.app_user WHERE email=lower(btrim(p_email)) FOR UPDATE;
 IF NOT FOUND OR u.status<>'active' OR u.mfa_enforced OR u.passkey_required
    OR u.password_hash IS DISTINCT FROM p_expected_hash THEN
  RAISE EXCEPTION 'invalid authentication' USING ERRCODE='42501'; END IF;
 INSERT INTO public.auth_session(user_id,token_digest,csrf_digest) VALUES(u.id,p_digest,p_csrf) RETURNING id INTO sid;
 RETURN sid;
END $$;
CREATE OR REPLACE FUNCTION session_resolve(p_digest bytea)
RETURNS TABLE(session_id uuid,user_id uuid,csrf_digest bytea,expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.auth_session s SET last_active_at=clock_timestamp()
 FROM public.app_user u WHERE s.token_digest=p_digest AND octet_length(p_digest)=32 AND s.user_id=u.id
 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.last_active_at>clock_timestamp()-interval '30 minutes'
 AND u.status='active' AND NOT u.mfa_enforced AND (NOT u.passkey_required OR s.mfa_verified_at IS NOT NULL)
 RETURNING s.id,s.user_id,s.csrf_digest,s.expires_at
$$;

CREATE FUNCTION passkey_required(p_email text,p_expected text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce((SELECT u.passkey_required FROM public.app_user u
  WHERE u.email=lower(btrim(p_email)) AND u.password_hash=p_expected AND u.status='active'),false)
$$;

CREATE FUNCTION passkey_begin(p_purpose text,p_email text,p_expected text,p_digest bytea,
 p_csrf bytea,p_challenge bytea,p_rp text,p_origin text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u public.app_user; s public.auth_session; cid uuid; BEGIN
 IF p_purpose='enroll' THEN
  SELECT * INTO s FROM public.auth_session WHERE token_digest=p_digest AND revoked_at IS NULL
   AND expires_at>clock_timestamp() AND last_active_at>clock_timestamp()-interval '30 minutes'
   AND created_at>clock_timestamp()-interval '5 minutes' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO u FROM public.app_user WHERE id=s.user_id FOR UPDATE;
  IF u.passkey_required AND (s.mfa_verified_at IS NULL OR s.mfa_verified_at<clock_timestamp()-interval '5 minutes') THEN RETURN NULL; END IF;
 ELSE
  IF p_purpose<>'login' THEN RETURN NULL; END IF;
  SELECT * INTO u FROM public.app_user WHERE email=lower(btrim(p_email)) FOR UPDATE;
  IF NOT FOUND OR NOT u.passkey_required THEN RETURN NULL; END IF;
 END IF;
 IF u.status<>'active' OR u.mfa_enforced OR u.password_hash IS DISTINCT FROM p_expected
  OR octet_length(p_csrf)<>32 OR octet_length(p_challenge)<>32 THEN RETURN NULL; END IF;
 IF p_purpose='enroll' AND (SELECT count(*) FROM public.auth_passkey WHERE user_id=u.id)>=5 THEN RETURN NULL; END IF;
 -- One outstanding ceremony per account and purpose bounds pending work/storage.
 DELETE FROM public.auth_passkey_challenge WHERE user_id=u.id AND purpose=p_purpose;
 INSERT INTO public.auth_passkey_challenge(user_id,purpose,session_id,csrf_digest,password_hash,challenge,rp,origin)
  VALUES(u.id,p_purpose,s.id,p_csrf,p_expected,p_challenge,p_rp,p_origin) RETURNING id INTO cid;
 RETURN jsonb_build_object('id',cid,'user_id',u.id,'credentials',coalesce((
  SELECT jsonb_agg(encode(k.id,'hex')) FROM public.auth_passkey k WHERE k.user_id=u.id),'[]'::jsonb));
END $$;

-- Consume before expensive verification in a separately committed transaction.
-- Failed signature/origin/counter checks therefore cannot reuse the ceremony.
CREATE FUNCTION passkey_take(p_id uuid,p_purpose text,p_digest bytea,p_csrf bytea) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE ch public.auth_passkey_challenge; BEGIN
 UPDATE public.auth_passkey_challenge SET consumed_at=clock_timestamp()
 WHERE id=p_id AND purpose=p_purpose AND consumed_at IS NULL AND expires_at>clock_timestamp()
  AND csrf_digest=p_csrf AND (p_purpose='login' OR session_id=(SELECT id FROM public.auth_session
    WHERE token_digest=p_digest AND revoked_at IS NULL AND expires_at>clock_timestamp()))
 RETURNING * INTO ch;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',ch.id,'user_id',ch.user_id,'challenge',encode(ch.challenge,'hex'),
  'rp',ch.rp,'origin',ch.origin,'credentials',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',encode(k.id,'hex'),'public_key',encode(k.public_key,'hex'),'sign_count',k.sign_count))
   FROM public.auth_passkey k WHERE k.user_id=ch.user_id),'[]'::jsonb));
END $$;

CREATE FUNCTION passkey_enrolled(p_id uuid,p_digest bytea,p_key_id bytea,p_key bytea,p_count bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE ch public.auth_passkey_challenge; u public.app_user; BEGIN
 SELECT * INTO ch FROM public.auth_passkey_challenge WHERE id=p_id AND purpose='enroll'
  AND consumed_at IS NOT NULL AND completed_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public.auth_session WHERE id=ch.session_id AND token_digest=p_digest AND revoked_at IS NULL
  AND expires_at>clock_timestamp() AND last_active_at>clock_timestamp()-interval '30 minutes' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO u FROM public.app_user WHERE id=ch.user_id FOR UPDATE;
 IF u.status<>'active' OR u.mfa_enforced OR u.password_hash IS DISTINCT FROM ch.password_hash
  OR (SELECT count(*) FROM public.auth_passkey WHERE user_id=u.id)>=5 THEN RETURN false; END IF;
 INSERT INTO public.auth_passkey(id,user_id,public_key,sign_count) VALUES(p_key_id,u.id,p_key,p_count);
 UPDATE public.app_user SET passkey_required=true WHERE id=u.id;
 UPDATE public.auth_session SET revoked_at=coalesce(revoked_at,clock_timestamp()),version=version+1
  WHERE user_id=u.id AND revoked_at IS NULL;
 UPDATE public.auth_passkey_challenge SET completed_at=clock_timestamp() WHERE id=p_id;
 INSERT INTO public.security_event(user_id,code) VALUES(u.id,'PASSKEY_ENROLLED');
 RETURN true;
END $$;

CREATE FUNCTION passkey_authenticated(p_id uuid,p_key_id bytea,p_old_count bigint,p_new_count bigint,
 p_digest bytea,p_csrf bytea,p_previous bytea) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE ch public.auth_passkey_challenge; u public.app_user; sid uuid; BEGIN
 SELECT * INTO ch FROM public.auth_passkey_challenge WHERE id=p_id AND purpose='login'
  AND consumed_at IS NOT NULL AND completed_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO u FROM public.app_user WHERE id=ch.user_id FOR UPDATE;
 IF u.status<>'active' OR u.mfa_enforced OR NOT u.passkey_required OR u.password_hash IS DISTINCT FROM ch.password_hash
  OR octet_length(p_digest)<>32 OR octet_length(p_csrf)<>32 THEN RETURN NULL; END IF;
 UPDATE public.auth_passkey SET sign_count=p_new_count WHERE id=p_key_id AND user_id=u.id AND sign_count=p_old_count
  AND (p_new_count>p_old_count OR (p_old_count=0 AND p_new_count=0));
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.auth_session SET revoked_at=coalesce(revoked_at,clock_timestamp()),version=version+1
  WHERE token_digest=p_previous AND revoked_at IS NULL;
 INSERT INTO public.auth_session(user_id,token_digest,csrf_digest,mfa_verified_at)
  VALUES(u.id,p_digest,p_csrf,clock_timestamp()) RETURNING id INTO sid;
 UPDATE public.auth_passkey_challenge SET completed_at=clock_timestamp() WHERE id=p_id;
 INSERT INTO public.security_event(user_id,code) VALUES(u.id,'MFA_SIGNIN_COMPLETED');
 RETURN sid;
END $$;

REVOKE ALL ON FUNCTION passkey_required(text,text),passkey_begin(text,text,text,bytea,bytea,bytea,text,text),
 passkey_take(uuid,text,bytea,bytea),passkey_enrolled(uuid,bytea,bytea,bytea,bigint),
 passkey_authenticated(uuid,bytea,bigint,bigint,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION passkey_required(text,text),passkey_begin(text,text,text,bytea,bytea,bytea,text,text),
 passkey_take(uuid,text,bytea,bytea),passkey_enrolled(uuid,bytea,bytea,bytea,bigint),
 passkey_authenticated(uuid,bytea,bigint,bigint,bytea,bytea,bytea) TO orderfit_app;
