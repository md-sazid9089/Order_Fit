-- Row-level security (tenant isolation), roles and least-privilege grants.
--
-- How the API uses it, at the start of EVERY transaction (inside an explicit transaction -
-- with autocommit the setting would be gone after one statement):
--     SELECT set_config('app.business_id', '<business uuid>', true);   -- true = transaction-local
--     SELECT set_config('app.user_id',     '<user uuid>',     true);   -- the acting user
-- Use the transaction-local form (set_config(..., true) / SET LOCAL). A session-level SET leaks
-- one tenant's setting to the next request on a pooled connection. Transaction-local settings
-- are safe with PgBouncer / Neon transaction pooling.
--
-- If app.business_id is unset the policies match nothing: the safe default is "see no rows".
--
-- Roles (NOLOGIN groups; LOGIN users and passwords are created per environment, never here):
--   migrator          : owns the tables, runs migrations (the role running this file)
--   orderfit_app      : the API / agent             -> e.g. CREATE ROLE orderfit_api LOGIN ...; GRANT orderfit_app TO orderfit_api;
--   orderfit_admin    : the cross-tenant console    -> member of orderfit_app, sees every tenant
--   orderfit_readonly : reports, support
-- IMPORTANT: superusers bypass RLS, and FORCE below restricts the table owner. The API must
-- connect as a member of orderfit_app, never as the owner / migrator / postgres.

CREATE FUNCTION app_business_id() RETURNS uuid LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT nullif(current_setting('app.business_id', true), '')::uuid
$$;

CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orderfit_app')      THEN CREATE ROLE orderfit_app      NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orderfit_readonly') THEN CREATE ROLE orderfit_readonly NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orderfit_admin')    THEN CREATE ROLE orderfit_admin    NOLOGIN; END IF;
  IF NOT pg_has_role('orderfit_admin', 'orderfit_app', 'USAGE') THEN GRANT orderfit_app TO orderfit_admin; END IF;
END $$;

-- ---------------------------------------------------------------------------------------
-- Tenant isolation. The policy is a plain equality so the planner can use the
-- (business_id, ...) indexes; cross-tenant access is a ROLE (orderfit_admin), not a setting
-- the application could flip.
-- ---------------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'membership','customer','customer_invoice','payee','payee_bank_account','owner_constraints',
    'financing_offer','deal','document','extracted_field','cash_event','evaluation',
    'evaluation_option','deal_flag','negotiation_message','approval','execution_action','whatif_run',
    'notification','idempotency_key','operation_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    -- (SELECT fn()) makes Postgres evaluate the function once per query, not once per row
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (business_id = (SELECT app_business_id())) WITH CHECK (business_id = (SELECT app_business_id()))', t);
    EXECUTE format('CREATE POLICY platform_admin ON %I TO orderfit_admin USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

ALTER TABLE business ENABLE ROW LEVEL SECURITY;
ALTER TABLE business FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business
  USING (id = (SELECT app_business_id())) WITH CHECK (id = (SELECT app_business_id()));
CREATE POLICY platform_admin ON business TO orderfit_admin USING (true) WITH CHECK (true);

-- app_user: a user is visible to the members of a business they belong to, and to themselves
-- (app.user_id). Login looks a user up BEFORE any business is chosen, through auth_lookup()
-- below. RLS is enabled but NOT forced here, so that SECURITY DEFINER function (owned by the
-- migrator) can read it; the application roles are still restricted.
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_user_read ON app_user FOR SELECT
  USING (id = (SELECT app_user_id())
         OR EXISTS (SELECT 1 FROM membership m WHERE m.user_id = app_user.id AND m.business_id = (SELECT app_business_id())));
CREATE POLICY app_user_update ON app_user FOR UPDATE
  USING (id = (SELECT app_user_id())
         OR EXISTS (SELECT 1 FROM membership m WHERE m.user_id = app_user.id AND m.business_id = (SELECT app_business_id())));
CREATE POLICY app_user_insert ON app_user FOR INSERT WITH CHECK (true);   -- signup / invite; set app.user_id to the new id to read it back
CREATE POLICY platform_admin ON app_user TO orderfit_admin USING (true) WITH CHECK (true);

-- The auth functions below run as the migrator (table owner). FORCE RLS restricts owners, so
-- the owner gets an explicit read policy on the two tables those functions read.
DO $$
BEGIN
  EXECUTE format('CREATE POLICY owner_auth_read ON membership FOR SELECT TO %I USING (true)', current_user);
  EXECUTE format('CREATE POLICY owner_auth_read ON business   FOR SELECT TO %I USING (true)', current_user);
END $$;

-- ---------------------------------------------------------------------------------------
-- Login helpers (SECURITY DEFINER, pinned search_path, EXECUTE for the app role only)
-- ---------------------------------------------------------------------------------------
-- The only way the application can read a password hash: by exact e-mail, to verify a login.
CREATE FUNCTION auth_lookup(p_email text)
RETURNS TABLE (user_id uuid, password_hash text, auth_subject text, status text, mfa_enforced boolean, is_platform_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT u.id, u.password_hash, u.auth_subject, u.status, u.mfa_enforced, u.is_platform_admin
  FROM public.app_user u WHERE u.email = lower(btrim(p_email))
$$;

-- The businesses a user may switch to (before app.business_id is set).
CREATE FUNCTION user_businesses(p_user uuid)
RETURNS TABLE (business_id uuid, business_name text, role text, tier text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT b.id, b.name, m.role, r.tier
  FROM public.membership m
  JOIN public.business b ON b.id = m.business_id
  JOIN public.app_role r ON r.code = m.role
  WHERE m.user_id = p_user AND b.status <> 'suspended'
  ORDER BY b.name
$$;
REVOKE ALL ON FUNCTION auth_lookup(text), user_businesses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup(text), user_businesses(uuid) TO orderfit_app;

-- ---------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO orderfit_app, orderfit_readonly, orderfit_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO orderfit_app, orderfit_readonly;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO orderfit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO orderfit_app;

-- Financial records are never hard-deleted. Only expired idempotency keys may be.
GRANT DELETE ON idempotency_key TO orderfit_app;

-- Append-only / immutable tables: no UPDATE privilege at all (the triggers are the second lock).
REVOKE UPDATE ON approval, owner_constraints, evaluation_option, operation_log, evaluation FROM orderfit_app;
GRANT  UPDATE (superseded_at) ON evaluation TO orderfit_app;
REVOKE UPDATE ON notification FROM orderfit_app;
GRANT  UPDATE (read_at) ON notification TO orderfit_app;

-- Reference data is changed by migrations, not by the application.
REVOKE INSERT, UPDATE ON currency, app_role, deal_status, deal_transition, cash_event_kind FROM orderfit_app;

-- app_user: secrets are never readable, and the platform-admin flag is never writable, by the
-- application or reporting roles. (Use auth_lookup() for login. INSERT/UPDATE ... RETURNING
-- may only name the readable columns.)
REVOKE SELECT, INSERT, UPDATE ON app_user FROM orderfit_app, orderfit_readonly;
GRANT SELECT (id, email, full_name, is_platform_admin, mfa_enforced, status, preferences, last_active_at, created_at, updated_at)
  ON app_user TO orderfit_app, orderfit_readonly;
GRANT INSERT (id, email, full_name, password_hash, auth_subject, mfa_enforced, status, preferences)
  ON app_user TO orderfit_app;
GRANT UPDATE (email, full_name, password_hash, auth_subject, mfa_enforced, status, preferences, last_active_at)
  ON app_user TO orderfit_app;

-- Alembic's own table (created before this file runs): the application must not touch it.
DO $$
BEGIN
  IF to_regclass('public.alembic_version') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.alembic_version FROM orderfit_app;
  END IF;
END $$;

-- Defence in depth for the temp-table shadowing attack (the real fix is the pinned
-- search_path on every function): no TEMP tables for ordinary roles. Needs the database owner;
-- on a platform where the migrator does not own the database this is skipped with a warning.
DO $$
BEGIN
  EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'could not revoke TEMPORARY on database % (not the owner); functions are still protected by their search_path', current_database();
END $$;

-- LangGraph checkpointer (if the agent uses it): its tables live in their own schema, created
-- and owned by the application role, so AsyncPostgresSaver.setup() works without migrator
-- rights. Connect the checkpointer with  options=-c search_path=langgraph
CREATE SCHEMA IF NOT EXISTS langgraph;
GRANT USAGE, CREATE ON SCHEMA langgraph TO orderfit_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO orderfit_app, orderfit_readonly;
