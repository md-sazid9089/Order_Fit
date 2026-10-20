-- 0024_admin_user_management.sql
-- Enables comprehensive platform administrative reads across users, memberships, and organizations.
-- Adheres to least privilege: grants specific SELECT columns to orderfit_admin_reader.
-- Grants orderfit_admin_api to orderfit_runtime for restricted security-definer execution.

DO $$ BEGIN
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='orderfit_runtime') THEN
    GRANT orderfit_admin_api TO orderfit_runtime;
  END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='orderfit_app') THEN
    -- In some test environments, orderfit_app is the runtime role
    GRANT orderfit_admin_api TO orderfit_app;
  END IF;
END $$;

-- Grant column read privileges on membership and app_user to orderfit_admin_reader
GRANT SELECT(user_id, business_id, role, created_at, version, revoked_at) ON membership TO orderfit_admin_reader;
GRANT SELECT(status, created_at) ON app_user TO orderfit_admin_reader;

-- RLS Policy on membership for orderfit_admin_reader
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='membership' AND policyname='admin_summary_read'
  ) THEN
    CREATE POLICY admin_summary_read ON membership FOR SELECT TO orderfit_admin_reader USING (true);
  END IF;
END $$;

-- Enhanced overview with privileged account and membership totals
CREATE OR REPLACE FUNCTION admin_read_overview(p_digest bytea) RETURNS jsonb
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
  'privileged_users',(SELECT count(DISTINCT u.id) FROM public.app_user u
                      LEFT JOIN public.membership m ON m.user_id = u.id
                      WHERE u.is_platform_admin = true OR (m.role IN ('owner', 'risk_officer') AND m.revoked_at IS NULL)),
  'active_memberships',(SELECT count(*) FROM public.membership WHERE revoked_at IS NULL),
  'revoked_memberships',(SELECT count(*) FROM public.membership WHERE revoked_at IS NOT NULL),
  'total_memberships',(SELECT count(*) FROM public.membership),
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

-- Enhanced user listing with multi-tenant memberships aggregation
CREATE OR REPLACE FUNCTION admin_read_users(p_digest bytea,p_limit integer,p_after uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.admin_read_identity(p_digest);
 IF p_limit IS NULL OR p_limit<1 OR p_limit>101 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='OA422'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) FROM (
  SELECT
    u.id,
    u.email,
    u.full_name,
    u.is_platform_admin,
    u.status,
    u.version,
    u.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'business_id', b.id,
          'business_name', b.name,
          'role', m.role,
          'revoked_at', m.revoked_at,
          'version', m.version
        ) ORDER BY m.created_at DESC
      ) FILTER (WHERE m.business_id IS NOT NULL),
      '[]'::jsonb
    ) AS memberships
  FROM public.app_user u
  LEFT JOIN public.membership m ON m.user_id = u.id
  LEFT JOIN public.business b ON b.id = m.business_id
  WHERE p_after IS NULL OR u.id > p_after
  GROUP BY u.id, u.email, u.full_name, u.is_platform_admin, u.status, u.version, u.created_at
  ORDER BY u.id
  LIMIT p_limit) q);
END $$;

ALTER FUNCTION public.admin_read_overview(bytea) OWNER TO orderfit_admin_reader;
ALTER FUNCTION public.admin_read_users(bytea,integer,uuid) OWNER TO orderfit_admin_reader;
GRANT EXECUTE ON FUNCTION public.admin_read_overview(bytea) TO orderfit_admin_api;
GRANT EXECUTE ON FUNCTION public.admin_read_users(bytea,integer,uuid) TO orderfit_admin_api;
