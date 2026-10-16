-- Runtime hardening (forward revision after 0012_notification_writer).
--
-- 1. Authentication throttling. 0005's auth_rate_consume(bytea) applied one fixed limit
--    (15 per 15 minutes) to every key and every attempt, successes included. Behind a shared
--    proxy address the per-source key therefore locked every user out after 16 attempts.
--    The limit is now an argument (the API passes a strict per-account/per-session limit
--    and a separate, higher per-source ceiling) and auth_rate_release() returns one unit
--    after a successful verification. Attempts are still consumed BEFORE the password is
--    verified, so concurrent guesses are bounded by the limit; only proven-correct
--    attempts are refunded, which does not help an attacker who lacks the password.
-- 2. session_password() locked app_user and then every session row of that user, while
--    session_resolve() (every authenticated request) locks one session row and the profile
--    update then locks app_user: opposite orders, so a password change and a profile update
--    from two sessions of the same user could deadlock. The session rows are now locked
--    first, in id order, matching session_resolve() -> app_user.
-- 3. Defense in depth: 0003 granted blanket INSERT, UPDATE on every table to orderfit_app.
--    The runtime never updates business.status/currency/is_synthetic/id/created_at or any
--    original-document identity/content column; UPDATE is narrowed to the columns the
--    application (or its invoker-rights revision triggers) actually writes. SELECT ... FOR
--    UPDATE/SHARE needs UPDATE on at least one column, which these grants keep.

DROP FUNCTION auth_rate_consume(bytea);
CREATE FUNCTION auth_rate_consume(p_key bytea,p_limit integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n integer; BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100000 OR octet_length(p_key)<>32 THEN
  RAISE EXCEPTION 'invalid rate limit request' USING ERRCODE='22023'; END IF;
 INSERT INTO public.auth_rate_limit AS r(key,count,started_at) VALUES(p_key,1,clock_timestamp())
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN r.started_at<clock_timestamp()-interval '15 minutes' THEN 1 ELSE r.count+1 END,
  started_at=CASE WHEN r.started_at<clock_timestamp()-interval '15 minutes' THEN clock_timestamp() ELSE r.started_at END
 RETURNING count INTO n;
 RETURN n<=p_limit;
END $$;
CREATE FUNCTION auth_rate_release(p_key bytea) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.auth_rate_limit SET count=count-1
 WHERE key=p_key AND count>0 AND started_at>=clock_timestamp()-interval '15 minutes'
$$;
REVOKE ALL ON FUNCTION auth_rate_consume(bytea,integer),auth_rate_release(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_rate_consume(bytea,integer),auth_rate_release(bytea) TO orderfit_app;

CREATE OR REPLACE FUNCTION session_password(p_digest bytea,p_expected text,p_new text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE uid uuid; BEGIN
 SELECT s.user_id INTO uid FROM public.auth_session s WHERE token_digest=p_digest AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF uid IS NULL OR p_new NOT LIKE '$argon2id$%' THEN RETURN false; END IF;
 -- Lock order: session rows (id order), then app_user, as session_resolve() + profile update.
 PERFORM 1 FROM public.auth_session WHERE user_id=uid AND revoked_at IS NULL ORDER BY id FOR UPDATE;
 UPDATE public.app_user SET password_hash=p_new,version=version+1 WHERE id=uid AND password_hash=p_expected AND status='active' AND NOT mfa_enforced;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.auth_session SET revoked_at=clock_timestamp(),version=version+1 WHERE user_id=uid AND revoked_at IS NULL;
 RETURN true;
END $$;

REVOKE UPDATE ON business FROM orderfit_app;
GRANT UPDATE (name,timezone,profile,baseline_settings,default_constraints_id,financial_revision,version)
 ON business TO orderfit_app;
-- No runtime path rewrites a stored document. source_role is review metadata (NULL for
-- historical ambiguous quotes) and version is maintained by the revision trigger; the
-- original identity/content (id, business_id, deal_id, kind, content_hash, storage_key,
-- original_filename, mime_type, size_bytes, untrusted, uploaded_by, uploaded_at) is not
-- updatable by the runtime role.
REVOKE UPDATE ON document FROM orderfit_app;
GRANT UPDATE (source_role,version) ON document TO orderfit_app;
