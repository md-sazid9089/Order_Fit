REVOKE orderfit_admin_api FROM orderfit_app,orderfit_worker,orderfit_readonly;

DO $$ DECLARE member_name text; BEGIN
 FOR member_name IN
  SELECT member.rolname FROM pg_auth_members membership
  JOIN pg_roles granted ON granted.oid=membership.roleid
  JOIN pg_roles member ON member.oid=membership.member
  WHERE granted.rolname='orderfit_admin_api'
    AND pg_has_role(member.oid,'orderfit_worker','USAGE')
 LOOP
  EXECUTE format('REVOKE orderfit_admin_api FROM %I',member_name);
 END LOOP;
END $$;

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

CREATE OR REPLACE FUNCTION admin_read_users(p_digest bytea,p_limit integer,p_after uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.admin_read_identity(p_digest);
 IF p_limit IS NULL OR p_limit<1 OR p_limit>101 THEN RAISE EXCEPTION 'invalid limit' USING ERRCODE='OA422'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]'::jsonb) FROM (
  SELECT id,email,full_name,is_platform_admin,version FROM public.app_user
  WHERE p_after IS NULL OR id>p_after ORDER BY id LIMIT p_limit) q);
END $$;

DROP POLICY IF EXISTS admin_summary_read ON membership;
REVOKE SELECT(user_id,business_id,role,created_at,version,revoked_at) ON membership FROM orderfit_admin_reader;
REVOKE SELECT(status,created_at) ON app_user FROM orderfit_admin_reader;

ALTER FUNCTION public.admin_read_overview(bytea) OWNER TO orderfit_admin_reader;
ALTER FUNCTION public.admin_read_users(bytea,integer,uuid) OWNER TO orderfit_admin_reader;
REVOKE ALL ON FUNCTION public.admin_read_overview(bytea), public.admin_read_users(bytea,integer,uuid)
 FROM PUBLIC,orderfit_app,orderfit_worker,orderfit_readonly;
GRANT EXECUTE ON FUNCTION public.admin_read_overview(bytea), public.admin_read_users(bytea,integer,uuid)
 TO orderfit_admin_api;
