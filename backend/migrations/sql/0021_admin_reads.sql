-- Two private roles: API callers and a non-login function owner. Neither has
-- BYPASSRLS. Only the owner has SELECT policies on these four specific tables.
-- Runtime never inherits the owner role; ordinary tenant policies stay intact.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='orderfit_admin_reader') THEN
  CREATE ROLE orderfit_admin_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
 END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='orderfit_admin_api') THEN
  CREATE ROLE orderfit_admin_api NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
 END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname IN ('orderfit_admin_reader','orderfit_admin_api')
    AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
  RAISE EXCEPTION 'unsafe administrative role configuration';
 END IF;
 EXECUTE format('GRANT orderfit_admin_reader TO %I',current_user);
END $$;
REVOKE ALL ON SCHEMA public FROM orderfit_admin_reader,orderfit_admin_api;
GRANT USAGE ON SCHEMA public TO orderfit_admin_reader,orderfit_admin_api;
-- Required temporarily to transfer function ownership. No runtime can become this role.
GRANT CREATE ON SCHEMA public TO orderfit_admin_reader;
GRANT SELECT(id,email,full_name,is_platform_admin,version), UPDATE(id) ON app_user TO orderfit_admin_reader;
GRANT SELECT(id,user_id,token_digest), UPDATE(id) ON auth_session TO orderfit_admin_reader;
GRANT SELECT(id,name,currency,timezone,status,created_at) ON business TO orderfit_admin_reader;
GRANT SELECT(id,business_id,status,currency,order_value_minor,created_at) ON deal TO orderfit_admin_reader;
CREATE POLICY admin_summary_read ON app_user FOR SELECT TO orderfit_admin_reader USING(true);
CREATE POLICY admin_summary_read ON auth_session FOR SELECT TO orderfit_admin_reader USING(true);
CREATE POLICY admin_summary_read ON business FOR SELECT TO orderfit_admin_reader USING(true);
CREATE POLICY admin_summary_read ON deal FOR SELECT TO orderfit_admin_reader USING(true);
-- Locking SELECT needs UPDATE privilege/policy, but actual writes are forbidden.
CREATE POLICY admin_summary_lock ON app_user FOR UPDATE TO orderfit_admin_reader USING(true) WITH CHECK(false);
CREATE POLICY admin_summary_lock ON auth_session FOR UPDATE TO orderfit_admin_reader USING(true) WITH CHECK(false);
GRANT EXECUTE ON FUNCTION session_resolve(bytea) TO orderfit_admin_reader;

CREATE FUNCTION admin_read_identity(p_digest bytea) RETURNS TABLE(user_id uuid,session_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE uid uuid; sid uuid; allowed boolean;
BEGIN
 SELECT s.user_id INTO uid FROM public.auth_session s WHERE s.token_digest=p_digest AND octet_length(p_digest)=32;
 IF uid IS NULL THEN RAISE EXCEPTION 'invalid session' USING ERRCODE='OA401'; END IF;
 -- Platform role updates lock user first and revoke sessions second. Follow that
 -- order. NOWAIT on session avoids inversion with older passkey session->user flows;
 -- contention returns retryable 503 instead of a deadlock or stale authority.
 SELECT u.is_platform_admin INTO allowed FROM public.app_user u WHERE u.id=uid FOR SHARE;
 PERFORM s.id FROM public.auth_session s WHERE s.token_digest=p_digest FOR UPDATE NOWAIT;
 SELECT r.session_id INTO sid FROM public.session_resolve(p_digest) r;
 IF sid IS NULL THEN RAISE EXCEPTION 'invalid session' USING ERRCODE='OA401'; END IF;
 IF allowed IS NOT TRUE THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='OA403'; END IF;
 RETURN QUERY SELECT uid,sid;
END $$;

CREATE FUNCTION admin_read_overview(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.admin_read_identity(p_digest);
 IF EXISTS(SELECT FROM public.deal d WHERE d.currency NOT IN ('BDT','USD','EUR','GBP')
      OR (d.order_value_minor IS NOT NULL AND (d.order_value_minor<0 OR d.order_value_minor>9000000000000000))) THEN
  RAISE EXCEPTION 'unsupported administrative data' USING ERRCODE='OA422';
 END IF;
 SELECT jsonb_build_object(
  'as_of',statement_timestamp(),
  'total_users',(SELECT count(*) FROM public.app_user),
  'total_tenants',(SELECT count(*) FROM public.business),
  'active_tenants',(SELECT count(*) FROM public.business WHERE status='active'),
  'total_orders',(SELECT count(*) FROM public.deal),
  'orders_without_value',(SELECT count(*) FROM public.deal WHERE order_value_minor IS NULL),
  'order_value_by_currency',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'currency',g.currency,'amount_minor',g.amount::text,'orders_with_value',g.n) ORDER BY g.currency)
   FROM (SELECT currency,sum(order_value_minor) AS amount,count(*) AS n FROM public.deal
         WHERE order_value_minor IS NOT NULL GROUP BY currency) g),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION admin_read_users(p_digest bytea,p_limit integer,p_after uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.admin_read_identity(p_digest);
 IF p_limit IS NULL OR p_limit<1 OR p_limit>101 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='OA422'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) FROM (
  SELECT id,email,full_name,is_platform_admin,version FROM public.app_user
  WHERE p_after IS NULL OR id>p_after ORDER BY id LIMIT p_limit) q);
END $$;

CREATE FUNCTION admin_read_tenants(p_digest bytea,p_limit integer,p_at timestamptz,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.admin_read_identity(p_digest);
 IF p_limit IS NULL OR p_limit<1 OR p_limit>101 OR (p_at IS NULL)<>(p_id IS NULL) THEN
  RAISE EXCEPTION 'invalid page' USING ERRCODE='OA422'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) FROM (
  SELECT id,name,currency,timezone,status,created_at FROM public.business
  WHERE p_id IS NULL OR (created_at,id)<(p_at,p_id) ORDER BY created_at DESC,id DESC LIMIT p_limit) q);
END $$;

CREATE FUNCTION admin_read_orders(p_digest bytea,p_limit integer,p_at timestamptz,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.admin_read_identity(p_digest);
 IF p_limit IS NULL OR p_limit<1 OR p_limit>101 OR (p_at IS NULL)<>(p_id IS NULL) THEN
  RAISE EXCEPTION 'invalid page' USING ERRCODE='OA422'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) FROM (
  SELECT id,business_id,status,currency,order_value_minor::text,created_at FROM public.deal
  WHERE p_id IS NULL OR (created_at,id)<(p_at,p_id) ORDER BY created_at DESC,id DESC LIMIT p_limit) q);
END $$;

DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['admin_read_identity(bytea)','admin_read_overview(bytea)',
  'admin_read_users(bytea,integer,uuid)','admin_read_tenants(bytea,integer,timestamptz,uuid)',
  'admin_read_orders(bytea,integer,timestamptz,uuid)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||signature||' FROM PUBLIC,orderfit_app,orderfit_worker,orderfit_readonly';
  EXECUTE 'ALTER FUNCTION public.'||signature||' OWNER TO orderfit_admin_reader';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||signature||' TO orderfit_admin_api';
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM orderfit_admin_reader;
-- Prevent runtime replacement of security-definer dependencies on older PG installations.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,orderfit_app,orderfit_worker,orderfit_readonly,orderfit_admin_api;
CREATE INDEX admin_business_created ON business(created_at DESC,id DESC);
CREATE INDEX admin_deal_created ON deal(created_at DESC,id DESC);
