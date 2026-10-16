-- OrderFit schema regression test.
--
-- Run as a SUPERUSER against a freshly migrated, THROWAWAY database (never a shared one):
--     psql -v ON_ERROR_STOP=1 -d orderfit_test -f backend/migrations/tests/test_schema.sql
-- Everything runs inside one transaction that is rolled back, so the database is left as it was.
-- Prints every failing check, then a summary line; exits non-zero if any check failed.
--
-- App-role checks run after SET ROLE orderfit_app / orderfit_readonly / orderfit_admin, so the
-- real grants and row-level security apply. Each check runs in a subtransaction through
-- of_test.try(), which returns 'OK' or 'ERR <SQLSTATE>: <message>'.
\set ON_ERROR_STOP 1
\pset pager off
BEGIN;

CREATE SCHEMA of_test;
GRANT USAGE ON SCHEMA of_test TO orderfit_app, orderfit_readonly, orderfit_admin;
CREATE TABLE of_test.results (n bigint GENERATED ALWAYS AS IDENTITY, id text, expect text, actual text, pass boolean);
GRANT INSERT, SELECT ON of_test.results TO orderfit_app, orderfit_readonly, orderfit_admin;

CREATE FUNCTION of_test.try(p_sql text, p_keep boolean DEFAULT false) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_state text; v_msg text;
BEGIN
  BEGIN
    EXECUTE p_sql;
    IF NOT p_keep THEN RAISE EXCEPTION USING ERRCODE = 'TT001', MESSAGE = '__rollback__'; END IF;
    RETURN 'OK';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state = 'TT001' THEN RETURN 'OK'; END IF;
    RETURN 'ERR ' || v_state || ': ' || v_msg;
  END;
END $f$;
-- expect: 'OK', 'ERR' (any error) or 'ERR <SQLSTATE>' (prefix match)
CREATE FUNCTION of_test.chk(p_id text, p_expect text, p_sql text, p_keep boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE v text := of_test.try(p_sql, p_keep);
BEGIN
  INSERT INTO of_test.results (id, expect, actual, pass) VALUES (p_id, p_expect, left(v, 300), v LIKE p_expect || '%');
END $f$;
CREATE FUNCTION of_test.eq(p_id text, p_expect text, p_actual text) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO of_test.results (id, expect, actual, pass) VALUES (p_id, p_expect, coalesce(p_actual, '<null>'), p_actual IS NOT DISTINCT FROM p_expect);
$f$;

-- ids
CREATE FUNCTION of_test.ba()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-000000000000'::uuid $$;
CREATE FUNCTION of_test.bb()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'b0000000-0000-4000-8000-000000000000'::uuid $$;
CREATE FUNCTION of_test.ua()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a1000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.uc()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a1000000-0000-4000-8000-000000000002'::uuid $$;
CREATE FUNCTION of_test.us()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a1000000-0000-4000-8000-000000000003'::uuid $$;
CREATE FUNCTION of_test.uv()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a1000000-0000-4000-8000-000000000004'::uuid $$;
CREATE FUNCTION of_test.ub()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'b1000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.ca()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a2000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.custa()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a3000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.custa2() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a3000000-0000-4000-8000-000000000002'::uuid $$;
CREATE FUNCTION of_test.custb()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'b3000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.paya()   RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a4000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.da1() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a5000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.da2() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a5000000-0000-4000-8000-000000000002'::uuid $$;
CREATE FUNCTION of_test.db1() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'b5000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.doca()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a6000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.doca2() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a6000000-0000-4000-8000-000000000002'::uuid $$;
CREATE FUNCTION of_test.docb()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'b6000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.eva() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a7000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.evb() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'b7000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.msga()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a8000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.msga2() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a8000000-0000-4000-8000-000000000002'::uuid $$;
CREATE FUNCTION of_test.msgb()  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'b8000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION of_test.t()     RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a5000000-0000-4000-8000-0000000000ff'::uuid $$;
CREATE FUNCTION of_test.mdeal() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a5000000-0000-4000-8000-000000000020'::uuid $$;
CREATE FUNCTION of_test.kdeal() RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT 'a5000000-0000-4000-8000-000000000010'::uuid $$;

-- A deal in business A with complete terms in ANY status. SECURITY DEFINER (superuser) so it
-- can create test deals in states the application itself may not insert.
CREATE FUNCTION of_test.mkdeal(p_id uuid, p_status text, p_round int DEFAULT 0) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $f$
  INSERT INTO public.deal (id, business_id, public_ref, customer_id, status, constraints_id, created_by,
                           opening_cash_minor, order_value_minor, delivery_date, payment_days, payment_basis,
                           negotiation_round, closed_at)
  VALUES (p_id, of_test.ba(), 'T-' || p_id::text, of_test.custa(), p_status, of_test.ca(), of_test.ua(),
          100000, 500000, current_date + 30, 45, 'delivery', p_round,
          CASE WHEN p_status IN ('committed','closed') THEN now() END)
$f$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA of_test TO orderfit_app, orderfit_readonly, orderfit_admin;

-- ======================================================================= fixture (superuser)
INSERT INTO business (id, name, currency) VALUES (of_test.ba(), 'Biz A', 'BDT'), (of_test.bb(), 'Biz B', 'USD');
INSERT INTO app_user (id, email, full_name, status, password_hash, is_platform_admin) VALUES
  (of_test.ua(), 'owner.a@example.test', 'Owner A',  'active',    'hash-a1', false),
  (of_test.uc(), 'lead.a@example.test',  'Lead A',   'active',    'hash-a2', false),
  (of_test.us(), 'susp.a@example.test',  'Susp A',   'suspended', 'hash-a3', false),
  (of_test.uv(), 'view.a@example.test',  'Viewer A', 'active',    'hash-a4', false),
  (of_test.ub(), 'owner.b@example.test', 'Owner B',  'active',    'hash-b1', false);
INSERT INTO membership (user_id, business_id, role) VALUES
  (of_test.ua(), of_test.ba(), 'owner'), (of_test.uc(), of_test.ba(), 'commercial_lead'),
  (of_test.us(), of_test.ba(), 'owner'), (of_test.uv(), of_test.ba(), 'viewer'),
  (of_test.ub(), of_test.bb(), 'owner');
INSERT INTO owner_constraints (id, business_id, version, safety_reserve_minor, created_by, deposit_discount_bps_per_10pct) VALUES
  (of_test.ca(), of_test.ba(), 1, 10000000, of_test.ua(), 50),
  ('b2000000-0000-4000-8000-000000000001', of_test.bb(), 1, 5000000, of_test.ub(), 0);
INSERT INTO customer (id, business_id, name) VALUES
  (of_test.custa(), of_test.ba(), 'Customer A'), (of_test.custa2(), of_test.ba(), 'Customer A2'), (of_test.custb(), of_test.bb(), 'Customer B');
INSERT INTO payee (id, business_id, name, category) VALUES
  (of_test.paya(), of_test.ba(), 'Supplier A', 'raw_material'),
  ('b4000000-0000-4000-8000-000000000001', of_test.bb(), 'Supplier B', 'raw_material');
INSERT INTO payee_bank_account (business_id, payee_id, account_fingerprint, last4) VALUES
  (of_test.bb(), 'b4000000-0000-4000-8000-000000000001', sha256('acct-b'), '1234');
INSERT INTO financing_offer (business_id, name, kind, interest_bps, max_minor, term_days) VALUES
  (of_test.ba(), 'OD A', 'revolving_overdraft', 180, 15000000, 90), (of_test.bb(), 'OD B', 'revolving_overdraft', 180, 15000000, 90);
INSERT INTO deal (id, business_id, public_ref, customer_id, constraints_id, created_by) VALUES
  (of_test.da1(), of_test.ba(), 'OF-A1', of_test.custa(), of_test.ca(), of_test.ua()),
  (of_test.da2(), of_test.ba(), 'OF-A2', of_test.custa(), of_test.ca(), of_test.ua()),
  (of_test.db1(), of_test.bb(), 'OF-B1', of_test.custb(), 'b2000000-0000-4000-8000-000000000001', of_test.ub());
INSERT INTO document (id, business_id, deal_id, kind, content_hash, storage_key, original_filename, mime_type, size_bytes, uploaded_by) VALUES
  (of_test.doca(),  of_test.ba(), of_test.da1(), 'po', sha256('doca'),  'k1', 'po.pdf', 'application/pdf', 100, of_test.ua()),
  (of_test.doca2(), of_test.ba(), of_test.da2(), 'po', sha256('doca2'), 'k2', 'po.pdf', 'application/pdf', 100, of_test.ua()),
  (of_test.docb(),  of_test.bb(), of_test.db1(), 'po', sha256('docb'),  'k3', 'po.pdf', 'application/pdf', 100, of_test.ub());
INSERT INTO cash_event (business_id, deal_id, event_date, amount_minor, direction, kind) VALUES
  (of_test.ba(), NULL, current_date + 10, 500000, 'out', 'payroll'),
  (of_test.bb(), NULL, current_date + 10, 400000, 'out', 'payroll'),
  (of_test.bb(), of_test.db1(), current_date + 40, 900000, 'in', 'order_receipt');
INSERT INTO deal_flag (business_id, deal_id, kind, code, message, blocking, raised_by) VALUES
  (of_test.bb(), of_test.db1(), 'ambiguity', 'E-MISSING-ANCHOR', 'anchor?', true, 'agent');
INSERT INTO customer_invoice (business_id, customer_id, invoice_ref, invoice_date, due_date, amount_minor, paid_minor, paid_date) VALUES
  (of_test.bb(), of_test.custb(), 'INV-B1', current_date - 60, current_date - 30, 1000, 1000, current_date - 20);
INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES
  (of_test.bb(), of_test.db1(), of_test.docb(), 'order_value_minor', '900000', 0.9);
-- deals A1 / B1 to computing so evaluations may be stored (A1 fixed terms first)
UPDATE deal SET opening_cash_minor = 100000, order_value_minor = 500000, delivery_date = current_date + 30,
                payment_days = 45, payment_basis = 'delivery' WHERE id IN (of_test.da1(), of_test.db1());
UPDATE deal SET status = 'awaiting_confirm' WHERE id IN (of_test.da1(), of_test.db1());
UPDATE deal_flag SET resolved_at = now(), resolved_by = of_test.ub() WHERE deal_id = of_test.db1();
UPDATE deal SET status = 'computing' WHERE id IN (of_test.da1(), of_test.db1());
INSERT INTO evaluation (id, business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor, recommended_option_key) VALUES
  (of_test.eva(), of_test.ba(), of_test.da1(), 0, 'ref-0.1.0', sha256('in-a'), '{}', '{}', 'plan_recommended', 100, 'dep40'),
  (of_test.evb(), of_test.bb(), of_test.db1(), 0, 'ref-0.1.0', sha256('in-b'), '{}', '{}', 'plan_recommended', 100, 'dep40');
INSERT INTO evaluation_option (business_id, evaluation_id, option_key, rank, levers, cost_minor, lowest_balance_minor, meets_target) VALUES
  (of_test.ba(), of_test.eva(), 'dep40', 1, '{}', 0, 100, true),
  (of_test.bb(), of_test.evb(), 'dep40', 1, '{}', 0, 100, true);
SET CONSTRAINTS ALL IMMEDIATE;   -- the fixture's deferred FKs (recommended option) must hold
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO negotiation_message (id, business_id, deal_id, round, direction, counterparty_kind, body) VALUES
  (of_test.msgb(),  of_test.bb(), of_test.db1(), 0, 'outbound', 'customer', 'Hello B'),
  (of_test.msga2(), of_test.ba(), of_test.da2(), 0, 'outbound', 'customer', 'Message on deal A2');
INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.bb(), of_test.db1(), 'commit_plan', of_test.evb(), 'dep40', sha256('plan-b'), of_test.ub(), 'approved', 'k-b', now());
INSERT INTO operation_log (business_id, actor, action, outcome) VALUES (of_test.bb(), 'system', 'seed', 'completed');
INSERT INTO whatif_run (business_id, deal_id, user_id, params, result) VALUES (of_test.bb(), of_test.db1(), of_test.ub(), '{}', '{}');
INSERT INTO idempotency_key (business_id, key, scope, request_hash) VALUES (of_test.bb(), 'idem-1', 'test', sha256('r'));
INSERT INTO notification (business_id, user_id, title, message) VALUES (of_test.bb(), of_test.ub(), 'Hi B', 'note');
INSERT INTO execution_action (business_id, deal_id, kind, payload, plan_hash, idempotency_key)
  VALUES (of_test.bb(), of_test.db1(), 'cancellation', '{}', sha256('plan-b'), 'ex-b');

-- =================================================================== defaults filled by triggers
SELECT of_test.eq('fx1 deal currency/reserve/discount defaulted', 'BDT 10000000 50',
  (SELECT currency || ' ' || reserve_minor || ' ' || deposit_discount_bps_per_10pct FROM deal WHERE id = of_test.da2()));

-- ======================================================================= as orderfit_app, A
SET ROLE orderfit_app;
SELECT set_config('app.business_id', of_test.ba()::text, false);
SELECT set_config('app.user_id', of_test.ua()::text, false);

-- (a) tenant isolation
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['business','membership','customer','customer_invoice','payee','payee_bank_account','owner_constraints',
    'financing_offer','deal','document','extracted_field','cash_event','evaluation','evaluation_option','deal_flag',
    'negotiation_message','approval','execution_action','whatif_run','notification','idempotency_key','operation_log',
    'deal_pipeline','customer_payment_stats','approval_staleness','engine_input_coverage']
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %s IS DISTINCT FROM %L', t,
                   CASE WHEN t = 'business' THEN 'id' ELSE 'business_id' END, of_test.ba()) INTO n;
    PERFORM of_test.eq('a1 foreign rows visible: ' || t, '0', n::text);
  END LOOP;
  SELECT count(*) INTO n FROM engine_input_events e WHERE e.deal_id NOT IN (SELECT id FROM public.deal);
  PERFORM of_test.eq('a1 foreign rows visible: engine_input_events', '0', n::text);
  SELECT count(*) INTO n FROM app_user WHERE id NOT IN (SELECT user_id FROM membership);
  PERFORM of_test.eq('a1 foreign rows visible: app_user (users of other tenants)', '0', n::text);
END $$;
SELECT set_config('app.business_id', '', false);
SELECT set_config('app.user_id', '', false);
DO $$
DECLARE t text; n bigint; total bigint := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['business','app_user','membership','customer','customer_invoice','payee','payee_bank_account','owner_constraints',
    'financing_offer','deal','document','extracted_field','cash_event','evaluation','evaluation_option','deal_flag',
    'negotiation_message','approval','execution_action','whatif_run','notification','idempotency_key','operation_log']
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO n; total := total + n;
  END LOOP;
  PERFORM of_test.eq('a2 rows visible with no tenant set (23 tables)', '0', total::text);
END $$;
SELECT set_config('app.business_id', 'not-a-uuid', false);
SELECT of_test.chk('a3 garbage tenant id', 'ERR 22P02', $q$SELECT count(*) FROM deal$q$);
SELECT set_config('app.business_id', of_test.ba()::text, false);
SELECT set_config('app.user_id', of_test.ua()::text, false);
SELECT set_config('app.is_platform_admin', 'on', false);   -- the old GUC must have no effect
SELECT of_test.eq('a4 app.is_platform_admin GUC grants nothing', '0', (SELECT count(*)::text FROM deal WHERE business_id <> of_test.ba()));
SELECT set_config('app.is_platform_admin', '', false);

-- (b) no reference may cross a tenant or a deal
SELECT of_test.chk('b1 deal in A -> customer of B', 'ERR 23503', $q$
  INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by) VALUES (of_test.ba(), 'X-b1', of_test.custb(), of_test.ca(), of_test.ua())$q$);
SELECT of_test.chk('b2 cash_event in A -> deal of B', 'ERR 23503', $q$
  INSERT INTO cash_event (business_id, deal_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), of_test.db1(), current_date, 1, 'out', 'other')$q$);
SELECT of_test.chk('b3 approval in A -> evaluation of B', 'ERR 23503', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'commit_plan', of_test.evb(), 'dep40', sha256('p'), of_test.ua(), 'approved', 'b3', now())$q$);
SELECT of_test.chk('b4 approval in A -> message of B', 'ERR', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, message_id, message_sha256, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'send_message', of_test.eva(), 'dep40', sha256('p'), of_test.msgb(), sha256(convert_to('Hello B','UTF8')), of_test.ua(), 'approved', 'b4', now())$q$);
SELECT of_test.chk('b5 extracted_field in A -> document of B', 'ERR 23503', $q$
  INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES (of_test.ba(), of_test.da1(), of_test.docb(), 'x', '1', 0.5)$q$);
-- From 0012_notification_writer the runtime role has no INSERT at all (only p7_notify writes).
SELECT of_test.chk('b6 notification in A for a user of B',
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification' AND policyname = 'notification_definer_insert')
       THEN 'ERR 42501' ELSE 'ERR 23503' END, $q$
  INSERT INTO notification (business_id, user_id, title, message) VALUES (of_test.ba(), of_test.ub(), 't', 'm')$q$);
SELECT of_test.chk('b7 deal currency differs from business currency', 'ERR 23503', $q$
  INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by, currency) VALUES (of_test.ba(), 'X-b7', of_test.custa(), of_test.ca(), of_test.ua(), 'USD')$q$);

-- (e) state machine: every ordered pair of statuses
DO $$
DECLARE f text; t text; e boolean;
BEGIN
  FOR f IN SELECT code FROM deal_status ORDER BY sort_order LOOP
    FOR t IN SELECT code FROM deal_status ORDER BY sort_order LOOP
      CONTINUE WHEN f = t;
      e := EXISTS (SELECT 1 FROM deal_transition WHERE from_status = f AND to_status = t);
      PERFORM of_test.chk(format('e %s -> %s', f, t), CASE WHEN e THEN 'OK' ELSE 'ERR OF001' END,
        format('SELECT of_test.mkdeal(%L, %L); UPDATE deal SET status = %L WHERE id = %L', of_test.t(), f, t, of_test.t()));
    END LOOP;
  END LOOP;
END $$;
SELECT of_test.chk('e2 app INSERTs a deal as committed', 'ERR OF008', $q$
  INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by, status, closed_at) VALUES (of_test.ba(), 'X-e2', of_test.custa(), of_test.ca(), of_test.ua(), 'committed', now())$q$);
SELECT of_test.chk('e3 app INSERTs a deal as awaiting_approval', 'ERR OF008', $q$
  INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by, status) VALUES (of_test.ba(), 'X-e3', of_test.custa(), of_test.ca(), of_test.ua(), 'awaiting_approval')$q$);
SELECT of_test.chk('e4 app INSERTs a deal at round 2', 'ERR OF008', $q$
  INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by, negotiation_round) VALUES (of_test.ba(), 'X-e4', of_test.custa(), of_test.ca(), of_test.ua(), 2)$q$);
SELECT of_test.chk('e5 app INSERTs a deal normally', 'OK', $q$
  INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by) VALUES (of_test.ba(), 'X-e5', of_test.custa(), of_test.ca(), of_test.ua())$q$);

-- (f) cannot compute without complete, unambiguous terms
SELECT of_test.chk('f0 complete terms -> computing', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm'); UPDATE deal SET status = 'computing' WHERE id = of_test.t()$q$);
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['payment_basis','delivery_date','opening_cash_minor','order_value_minor','customer_id','payment_days'] LOOP
    PERFORM of_test.chk('f missing ' || c, 'ERR 23514',
      format('SELECT of_test.mkdeal(%L, ''awaiting_confirm''); UPDATE deal SET %I = NULL WHERE id = %L; UPDATE deal SET status = ''computing'' WHERE id = %L',
             of_test.t(), c, of_test.t(), of_test.t()));
  END LOOP;
END $$;
SELECT of_test.chk('f7 invoice basis without invoice_date', 'ERR 23514', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm'); UPDATE deal SET payment_basis = 'invoice' WHERE id = of_test.t();
  UPDATE deal SET status = 'computing' WHERE id = of_test.t()$q$);
SELECT of_test.chk('f8 order basis with order_date', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm'); UPDATE deal SET payment_basis = 'order', order_date = current_date WHERE id = of_test.t();
  UPDATE deal SET status = 'computing' WHERE id = of_test.t()$q$);

-- (g) blocking flags
SELECT of_test.chk('g1 open blocking flag blocks', 'ERR OF002', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm');
  INSERT INTO deal_flag (business_id, deal_id, kind, code, message, blocking, raised_by) VALUES (of_test.ba(), of_test.t(), 'ambiguity', 'E-MISSING-ANCHOR', 'm', true, 'agent');
  UPDATE deal SET status = 'computing' WHERE id = of_test.t()$q$);
SELECT of_test.chk('g2 resolved flag allows', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm');
  INSERT INTO deal_flag (business_id, deal_id, kind, code, message, blocking, raised_by) VALUES (of_test.ba(), of_test.t(), 'ambiguity', 'E-MISSING-ANCHOR', 'm', true, 'agent');
  UPDATE deal_flag SET resolved_at = now(), resolved_by = of_test.ua() WHERE deal_id = of_test.t();
  UPDATE deal SET status = 'computing' WHERE id = of_test.t()$q$);
SELECT of_test.chk('g3 non-blocking flag does not block', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm');
  INSERT INTO deal_flag (business_id, deal_id, kind, code, message, blocking, raised_by) VALUES (of_test.ba(), of_test.t(), 'validation', 'W-X', 'm', false, 'agent');
  UPDATE deal SET status = 'computing' WHERE id = of_test.t()$q$);
SELECT of_test.chk('g4 blocking flag blocks awaiting_approval -> awaiting_reply', 'ERR OF002', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_approval');
  INSERT INTO deal_flag (business_id, deal_id, kind, code, message, blocking, raised_by) VALUES (of_test.ba(), of_test.t(), 'fraud', 'SEC-FRAUD', 'm', true, 'system');
  UPDATE deal SET status = 'awaiting_reply' WHERE id = of_test.t()$q$);

-- (h) every engine input is frozen after confirmation
DO $$
DECLARE c text; v text;
BEGIN
  FOR c, v IN VALUES ('order_value_minor','600000'), ('opening_cash_minor','1'), ('reserve_minor','1'), ('start_date', 'current_date - 1'),
                     ('payment_days','60'), ('payment_basis','''invoice'''), ('delivery_date','current_date + 99'), ('order_date','current_date'),
                     ('invoice_date','current_date'), ('customer_id', 'of_test.custa2()'), ('target_scenario','''severe'''),
                     ('deposit_discount_bps','5'), ('deposit_discount_bps_per_10pct','5')
  LOOP
    PERFORM of_test.chk('h frozen while computing: ' || c, 'ERR OF003',
      format('SELECT of_test.mkdeal(%L, ''computing''); UPDATE deal SET %I = %s WHERE id = %L', of_test.t(), c, v, of_test.t()));
  END LOOP;
END $$;
SELECT of_test.chk('h po_number stays editable', 'OK', $q$SELECT of_test.mkdeal(of_test.t(), 'computing'); UPDATE deal SET po_number = 'PO-1' WHERE id = of_test.t()$q$);
SELECT of_test.chk('h back to awaiting_confirm, then edit, then recompute', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_approval'); UPDATE deal SET status = 'awaiting_confirm' WHERE id = of_test.t();
  UPDATE deal SET payment_days = 30 WHERE id = of_test.t(); UPDATE deal SET status = 'computing' WHERE id = of_test.t()$q$);
SELECT of_test.chk('h version forced by trigger', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'computing'); UPDATE deal SET version = 99 WHERE id = of_test.t();
  DO $d$ BEGIN IF (SELECT version FROM deal WHERE id = of_test.t()) <> 2 THEN RAISE EXCEPTION 'version not 2'; END IF; END $d$$q$);

-- (i) negotiation round
SELECT of_test.chk('i1 round 0 -> 2', 'ERR OF004',  $q$SELECT of_test.mkdeal(of_test.t(), 'computing', 0); UPDATE deal SET negotiation_round = 2 WHERE id = of_test.t()$q$);
SELECT of_test.chk('i2 round 0 -> 1', 'OK',         $q$SELECT of_test.mkdeal(of_test.t(), 'computing', 0); UPDATE deal SET negotiation_round = 1 WHERE id = of_test.t()$q$);
SELECT of_test.chk('i3 round 1 -> 0', 'ERR OF004',  $q$SELECT of_test.mkdeal(of_test.t(), 'computing', 1); UPDATE deal SET negotiation_round = 0 WHERE id = of_test.t()$q$);
SELECT of_test.chk('i4 round 3 -> 4', 'ERR 23514',  $q$SELECT of_test.mkdeal(of_test.t(), 'computing', 3); UPDATE deal SET negotiation_round = 4 WHERE id = of_test.t()$q$);

-- (j) money
SELECT of_test.chk('j1 amount 0',   'ERR 23514', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), current_date, 0, 'out', 'other')$q$);
SELECT of_test.chk('j2 amount -5',  'ERR 23514', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), current_date, -5, 'out', 'other')$q$);
SELECT of_test.chk('j3 bigint max', 'OK',        $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), current_date, 9223372036854775807, 'out', 'other')$q$);
SELECT of_test.chk('j4 bigint max + 1', 'ERR 22003', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), current_date, 9223372036854775808, 'out', 'other')$q$);
SELECT of_test.chk('j5 unknown currency', 'ERR 23503', $q$INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by, currency) VALUES (of_test.ba(), 'X-j5', of_test.custa(), of_test.ca(), of_test.ua(), 'XYZ')$q$);
SELECT of_test.chk('j6 order value 0', 'ERR 23514', $q$SELECT of_test.mkdeal(of_test.t(), 'ingesting'); UPDATE deal SET order_value_minor = 0 WHERE id = of_test.t()$q$);
SELECT of_test.chk('j7 reserve -1', 'ERR 23514', $q$INSERT INTO owner_constraints (business_id, version, safety_reserve_minor, created_by) VALUES (of_test.ba(), 99, -1, of_test.ua())$q$);
SELECT of_test.chk('j8 invoice paid > amount', 'ERR 23514', $q$INSERT INTO customer_invoice (business_id, customer_id, invoice_ref, invoice_date, due_date, amount_minor, paid_minor, paid_date) VALUES (of_test.ba(), of_test.custa(), 'I', current_date, current_date, 10, 11, current_date)$q$);
SELECT of_test.chk('j9 financing min > max', 'ERR 23514', $q$INSERT INTO financing_offer (business_id, name, kind, min_minor, max_minor, term_days) VALUES (of_test.ba(), 'x', 'term_loan', 10, 5, 30)$q$);
SELECT of_test.chk('j10 negative opening cash (overdraft) allowed', 'OK', $q$SELECT of_test.mkdeal(of_test.t(), 'ingesting'); UPDATE deal SET opening_cash_minor = -500 WHERE id = of_test.t()$q$);
SELECT of_test.chk('j11 financing term beyond 540 days', 'ERR 23514', $q$INSERT INTO financing_offer (business_id, name, kind, max_minor, term_days) VALUES (of_test.ba(), 'x', 'term_loan', 5, 541)$q$);

-- (k) dates
SELECT of_test.chk('k1 delivery before start', 'ERR 23514', $q$SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm'); UPDATE deal SET delivery_date = start_date - 10 WHERE id = of_test.t()$q$);
SELECT of_test.chk('k2 2028-02-29', 'OK', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), '2028-02-29', 1, 'out', 'other')$q$);
SELECT of_test.chk('k3 2027-02-29', 'ERR 22008', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), '2027-02-29', 1, 'out', 'other')$q$);
SELECT of_test.chk('k4 infinity', 'ERR 23514', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), 'infinity', 1, 'out', 'other')$q$);
SELECT of_test.chk('k5 9999-12-31', 'ERR 23514', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), '9999-12-31', 1, 'out', 'other')$q$);
SELECT of_test.chk('k6 0001-01-01', 'ERR 23514', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), '0001-01-01', 1, 'out', 'other')$q$);
SELECT of_test.chk('k7 deal delivery 9999-12-31', 'ERR 23514', $q$SELECT of_test.mkdeal(of_test.t(), 'ingesting'); UPDATE deal SET delivery_date = '9999-12-31' WHERE id = of_test.t()$q$);
SELECT of_test.chk('k8 leap-day offset', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'ingesting'); UPDATE deal SET start_date = '2028-02-28', delivery_date = '2028-03-30' WHERE id = of_test.t();
  INSERT INTO cash_event (business_id, deal_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), of_test.t(), '2028-03-01', 7, 'out', 'other');
  DO $d$ BEGIN IF (SELECT day FROM engine_input_events WHERE deal_id = of_test.t() AND amount_minor = 7) <> 2 THEN RAISE EXCEPTION 'day <> 2'; END IF; END $d$$q$);

-- (l) same-day ordering and engine contract vocabulary
SELECT of_test.chk('l1 apply_order puts outflows before inflows', 'OK', $q$
  SELECT of_test.mkdeal(of_test.t(), 'ingesting');
  INSERT INTO cash_event (business_id, deal_id, event_date, amount_minor, direction, kind) VALUES
    (of_test.ba(), of_test.t(), current_date + 5, 11, 'in', 'order_receipt'), (of_test.ba(), of_test.t(), current_date + 5, 12, 'out', 'supplier_payment');
  DO $d$ BEGIN IF (SELECT direction FROM engine_input_events WHERE deal_id = of_test.t() AND day = 5 ORDER BY day, apply_order, event_id LIMIT 1) <> 'out'
               THEN RAISE EXCEPTION 'inflow first'; END IF; END $d$$q$);
DO $$
DECLARE k text;
BEGIN
  FOREACH k IN ARRAY ARRAY['ap_payment','existing_inventory','ar_collection','loan_installment','payroll','rent','freight','labour','subcontract','supplier_payment'] LOOP
    PERFORM of_test.chk('l2 fixture kind storable: ' || k, 'OK',
      format('INSERT INTO cash_event (business_id, deal_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), of_test.da2(), current_date, 1, ''out'', %L)', k));
  END LOOP;
END $$;
SELECT of_test.chk('l3 certainty assumed', 'OK', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind, certainty) VALUES (of_test.ba(), current_date, 1, 'out', 'other', 'assumed')$q$);
SELECT of_test.chk('l4 order_deposit must be an inflow of a deal', 'ERR 23514', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), current_date, 1, 'in', 'order_deposit')$q$);
SELECT of_test.chk('l5 unknown kind', 'ERR 23503', $q$INSERT INTO cash_event (business_id, event_date, amount_minor, direction, kind) VALUES (of_test.ba(), current_date, 1, 'out', 'bribe')$q$);

-- (m) evaluations   MDEAL kept for the rest of the run
SELECT of_test.chk('m0 setup', 'OK', $q$
  SELECT of_test.mkdeal(of_test.mdeal(), 'computing');
  INSERT INTO evaluation (business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor)
  VALUES (of_test.ba(), of_test.mdeal(), 0, 'v1', sha256('h1'), '{}', '{}', 'no_feasible_plan', -5)$q$, true);
SELECT of_test.chk('m1 second live evaluation', 'ERR 23505', $q$
  INSERT INTO evaluation (business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor)
  VALUES (of_test.ba(), of_test.mdeal(), 0, 'v1', sha256('h2'), '{}', '{}', 'no_feasible_plan', -5)$q$);
SELECT of_test.chk('m2 supersede then insert', 'OK', $q$
  UPDATE evaluation SET superseded_at = now() WHERE deal_id = of_test.mdeal() AND input_hash = sha256('h1');
  INSERT INTO evaluation (business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor)
  VALUES (of_test.ba(), of_test.mdeal(), 0, 'v1', sha256('h2'), '{}', '{}', 'no_feasible_plan', -5)$q$, true);
SELECT of_test.chk('m3 app UPDATE verdict', 'ERR 42501', $q$UPDATE evaluation SET verdict = 'feasible_as_offered' WHERE deal_id = of_test.mdeal()$q$);
SELECT of_test.chk('m4 superseded_at twice', 'ERR 23000', $q$UPDATE evaluation SET superseded_at = clock_timestamp() WHERE deal_id = of_test.mdeal() AND input_hash = sha256('h1')$q$);
SELECT of_test.chk('m5 app DELETE', 'ERR 42501', $q$DELETE FROM evaluation WHERE deal_id = of_test.mdeal()$q$);
SELECT of_test.chk('m6 inputs revert A->B->A', 'OK', $q$
  UPDATE evaluation SET superseded_at = now() WHERE deal_id = of_test.mdeal() AND input_hash = sha256('h2');
  INSERT INTO evaluation (business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor)
  VALUES (of_test.ba(), of_test.mdeal(), 0, 'v1', sha256('h1'), '{}', '{}', 'no_feasible_plan', -5)$q$);
SELECT of_test.chk('m7 plan_recommended without option row', 'ERR 23503', $q$
  SELECT of_test.mkdeal(of_test.t(), 'computing');
  INSERT INTO evaluation (business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor, recommended_option_key)
  VALUES (of_test.ba(), of_test.t(), 0, 'v1', sha256('m7'), '{}', '{}', 'plan_recommended', 1, 'dep99');
  SET CONSTRAINTS ALL IMMEDIATE$q$);
SET CONSTRAINTS ALL DEFERRED;
SELECT of_test.chk('m8 evaluation round != deal round', 'ERR OF004', $q$
  SELECT of_test.mkdeal(of_test.t(), 'computing', 0);
  INSERT INTO evaluation (business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor)
  VALUES (of_test.ba(), of_test.t(), 1, 'v1', sha256('m8'), '{}', '{}', 'no_feasible_plan', 1)$q$);
SELECT of_test.chk('m9 evaluation while deal is not computing', 'ERR OF008', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm');
  INSERT INTO evaluation (business_id, deal_id, round, engine_version, input_hash, inputs, output, verdict, lowest_balance_minor)
  VALUES (of_test.ba(), of_test.t(), 0, 'v1', sha256('m9'), '{}', '{}', 'no_feasible_plan', 1)$q$);

-- (n) immutable tables as the app
SELECT of_test.chk('n1 UPDATE evaluation_option', 'ERR 42501', $q$UPDATE evaluation_option SET cost_minor = 1$q$);
SELECT of_test.chk('n2 DELETE evaluation_option', 'ERR 42501', $q$DELETE FROM evaluation_option$q$);
SELECT of_test.chk('n3 UPDATE approval', 'ERR 42501', $q$UPDATE approval SET decision = 'rejected'$q$);
SELECT of_test.chk('n4 DELETE approval', 'ERR 42501', $q$DELETE FROM approval$q$);
SELECT of_test.chk('n5 UPDATE owner_constraints', 'ERR 42501', $q$UPDATE owner_constraints SET safety_reserve_minor = 1$q$);
SELECT of_test.chk('n6 DELETE owner_constraints', 'ERR 42501', $q$DELETE FROM owner_constraints$q$);

-- (o) messages and approvals (deal A1, live evaluation eva)
SELECT of_test.chk('o0 draft message', 'OK', $q$
  INSERT INTO negotiation_message (id, business_id, deal_id, round, direction, counterparty_kind, body)
  VALUES (of_test.msga(), of_test.ba(), of_test.da1(), 0, 'outbound', 'customer', 'Please pay a 40% deposit')$q$, true);
SELECT of_test.chk('o0b outbound message inserted as sent', 'ERR OF006', $q$
  INSERT INTO negotiation_message (business_id, deal_id, round, direction, counterparty_kind, body, status, sent_at)
  VALUES (of_test.ba(), of_test.da1(), 0, 'outbound', 'customer', 'x', 'sent', now())$q$);
SELECT of_test.chk('o1 approve with correct sha + step-up', 'OK', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, message_id, message_sha256, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'send_message', of_test.eva(), 'dep40', sha256('plan'), of_test.msga(),
          (SELECT body_sha256 FROM negotiation_message WHERE id = of_test.msga()), of_test.ua(), 'approved', 'k-o1', now())$q$, true);
SELECT of_test.chk('o2 edit approved body', 'ERR 23503', $q$UPDATE negotiation_message SET body = 'Please pay 10%' WHERE id = of_test.msga()$q$);
SELECT of_test.chk('o3 wrong sha', 'ERR 23503', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, message_id, message_sha256, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'send_message', of_test.eva(), 'dep40', sha256('plan'), of_test.msga(), sha256('nope'), of_test.ua(), 'approved', 'k-o3', now())$q$);
SELECT of_test.chk('o4 approver from another business', 'ERR', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'commit_plan', of_test.eva(), 'dep40', sha256('plan'), of_test.ub(), 'approved', 'k-o4', now())$q$);
SELECT of_test.chk('o5 commercial_lead (T2) approves a commit', 'ERR OF005', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'commit_plan', of_test.eva(), 'dep40', sha256('plan'), of_test.uc(), 'approved', 'k-o5', now())$q$);
SELECT of_test.chk('o5b commercial_lead rejects a commit', 'OK', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key)
  VALUES (of_test.ba(), of_test.da1(), 'commit_plan', of_test.eva(), 'dep40', sha256('plan'), of_test.uc(), 'rejected', 'k-o5b')$q$);
SELECT of_test.chk('o5c commercial_lead confirms figures', 'OK', $q$
  INSERT INTO approval (business_id, deal_id, action, approver_id, decision, idempotency_key) VALUES (of_test.ba(), of_test.da1(), 'confirm_figures', of_test.uc(), 'approved', 'k-o5c')$q$);
SELECT of_test.chk('o5d viewer (T0) confirms figures', 'ERR OF005', $q$
  INSERT INTO approval (business_id, deal_id, action, approver_id, decision, idempotency_key) VALUES (of_test.ba(), of_test.da1(), 'confirm_figures', of_test.uv(), 'approved', 'k-o5d')$q$);
SELECT of_test.chk('o6 suspended approver', 'ERR OF005', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'commit_plan', of_test.eva(), 'dep40', sha256('plan'), of_test.us(), 'approved', 'k-o6', now())$q$);
SELECT of_test.chk('o7 forged body_sha256 is recomputed', 'OK', $q$
  UPDATE negotiation_message SET body_sha256 = sha256('forged') WHERE id = of_test.msga2();
  DO $d$ BEGIN IF (SELECT body_sha256 <> sha256(convert_to(body, 'UTF8')) FROM negotiation_message WHERE id = of_test.msga2()) THEN RAISE EXCEPTION 'forged hash kept'; END IF; END $d$$q$);
SELECT of_test.chk('o8 approval for a message of another deal', 'ERR 23503', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, message_id, message_sha256, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'send_message', of_test.eva(), 'dep40', sha256('plan'), of_test.msga2(),
          (SELECT body_sha256 FROM negotiation_message WHERE id = of_test.msga2()), of_test.ua(), 'approved', 'k-o8', now())$q$);
SELECT of_test.chk('o9 send approval without step-up', 'ERR 23514', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, message_id, message_sha256, approver_id, decision, idempotency_key)
  VALUES (of_test.ba(), of_test.da1(), 'send_message', of_test.eva(), 'dep40', sha256('plan'), of_test.msga(),
          (SELECT body_sha256 FROM negotiation_message WHERE id = of_test.msga()), of_test.ua(), 'approved', 'k-o9')$q$);
SELECT of_test.chk('o10 unapproved message marked sent', 'ERR OF006', $q$UPDATE negotiation_message SET status = 'approved' WHERE id = of_test.msga2()$q$);
SELECT of_test.chk('o11 unknown option', 'ERR 23503', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da1(), 'commit_plan', of_test.eva(), 'nope', sha256('plan'), of_test.ua(), 'approved', 'k-o11', now())$q$);
SELECT of_test.chk('o12 approval for deal A2 citing evaluation of deal A1', 'ERR 23503', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.da2(), 'commit_plan', of_test.eva(), 'dep40', sha256('plan'), of_test.ua(), 'approved', 'k-o12', now())$q$);
SELECT of_test.chk('o13 approval of a superseded evaluation', 'ERR OF005', $q$
  INSERT INTO approval (business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES (of_test.ba(), of_test.mdeal(), 'override',
          (SELECT id FROM evaluation WHERE deal_id = of_test.mdeal() AND input_hash = sha256('h1')), NULL, sha256('plan'), of_test.ua(), 'approved', 'k-o13', now())$q$);
SELECT of_test.chk('o14 approved message: draft -> approved -> sent', 'OK', $q$
  UPDATE negotiation_message SET status = 'approved' WHERE id = of_test.msga();
  UPDATE negotiation_message SET status = 'sent', sent_at = now() WHERE id = of_test.msga()$q$);
SELECT of_test.chk('o15 approved message back to draft', 'ERR OF006', $q$
  UPDATE negotiation_message SET status = 'approved' WHERE id = of_test.msga(); UPDATE negotiation_message SET status = 'draft' WHERE id = of_test.msga()$q$);

-- (p) idempotency
SELECT of_test.chk('p1 approval key reused', 'ERR 23505', $q$
  INSERT INTO approval (business_id, deal_id, action, approver_id, decision, idempotency_key) VALUES (of_test.ba(), of_test.da1(), 'confirm_figures', of_test.ua(), 'approved', 'k-o1')$q$);
SELECT of_test.chk('p2 same key in another business', 'OK', $q$
  SELECT set_config('app.business_id', of_test.bb()::text, true);
  INSERT INTO approval (business_id, deal_id, action, approver_id, decision, idempotency_key) VALUES (of_test.bb(), of_test.db1(), 'confirm_figures', of_test.ub(), 'approved', 'k-o1')$q$);
SELECT of_test.chk('p3 idempotency_key duplicate', 'ERR 23505', $q$
  SELECT set_config('app.business_id', of_test.bb()::text, true);
  INSERT INTO idempotency_key (business_id, key, scope, request_hash) VALUES (of_test.bb(), 'idem-1', 's', sha256('r'))$q$);
SELECT of_test.chk('p4 same key, other business', 'OK', $q$INSERT INTO idempotency_key (business_id, key, scope, request_hash) VALUES (of_test.ba(), 'idem-1', 's', sha256('r'))$q$);

-- (x) execution actions (before eva is superseded)
SELECT of_test.chk('x0 commit approval for execution', 'OK', $q$
  INSERT INTO approval (id, business_id, deal_id, action, evaluation_id, option_key, action_plan_hash, approver_id, decision, idempotency_key, step_up_verified_at)
  VALUES ('a9000000-0000-4000-8000-000000000001', of_test.ba(), of_test.da1(), 'commit_plan', of_test.eva(), 'dep40', sha256('exec-plan'), of_test.ua(), 'approved', 'k-x0', now())$q$, true);
SELECT of_test.chk('x1 draft a ledger entry', 'OK', $q$
  INSERT INTO execution_action (id, business_id, deal_id, kind, payee_id, amount_minor, scheduled_date, payload, plan_hash, idempotency_key)
  VALUES ('aa000000-0000-4000-8000-000000000001', of_test.ba(), of_test.da1(), 'ledger_entry', of_test.paya(), 90000, current_date + 3, '{"memo":"deposit"}', sha256('exec-plan'), 'x1')$q$, true);
SELECT of_test.chk('x2 insert already scheduled', 'ERR OF007', $q$
  INSERT INTO execution_action (business_id, deal_id, kind, payload, plan_hash, idempotency_key, status, approval_id)
  VALUES (of_test.ba(), of_test.da1(), 'cancellation', '{}', sha256('exec-plan'), 'x2', 'scheduled', 'a9000000-0000-4000-8000-000000000001')$q$);
SELECT of_test.chk('x3 change payload after drafting', 'ERR OF007', $q$UPDATE execution_action SET payload = '{"memo":"x"}' WHERE id = 'aa000000-0000-4000-8000-000000000001'$q$);
SELECT of_test.chk('x4 schedule without approval', 'ERR OF007', $q$UPDATE execution_action SET status = 'scheduled' WHERE id = 'aa000000-0000-4000-8000-000000000001'$q$);
SELECT of_test.chk('x5 schedule with an approval for another plan', 'ERR OF007', $q$
  UPDATE execution_action SET status = 'scheduled', approval_id = (SELECT id FROM approval WHERE idempotency_key = 'k-o1')
  WHERE id = 'aa000000-0000-4000-8000-000000000001'$q$);
SELECT of_test.chk('x6 schedule with the matching approval, then post', 'OK', $q$
  UPDATE execution_action SET status = 'scheduled', approval_id = 'a9000000-0000-4000-8000-000000000001' WHERE id = 'aa000000-0000-4000-8000-000000000001';
  UPDATE execution_action SET status = 'posted' WHERE id = 'aa000000-0000-4000-8000-000000000001';
  DO $d$ BEGIN IF (SELECT executed_at IS NULL FROM execution_action WHERE id = 'aa000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'executed_at not set'; END IF; END $d$$q$);
SELECT of_test.chk('x7 posted -> scheduled', 'ERR OF007', $q$
  UPDATE execution_action SET status = 'scheduled', approval_id = 'a9000000-0000-4000-8000-000000000001' WHERE id = 'aa000000-0000-4000-8000-000000000001';
  UPDATE execution_action SET status = 'posted' WHERE id = 'aa000000-0000-4000-8000-000000000001';
  UPDATE execution_action SET status = 'scheduled' WHERE id = 'aa000000-0000-4000-8000-000000000001'$q$);
SELECT of_test.chk('x8 schedule after the evaluation was superseded', 'ERR OF007', $q$
  UPDATE evaluation SET superseded_at = now() WHERE id = of_test.eva();
  UPDATE execution_action SET status = 'scheduled', approval_id = 'a9000000-0000-4000-8000-000000000001' WHERE id = 'aa000000-0000-4000-8000-000000000001'$q$);
SELECT of_test.chk('x9 app DELETE execution_action', 'ERR 42501', $q$DELETE FROM execution_action$q$);

-- (q) approval status view
SELECT of_test.eq('q1 approval valid before supersede', 'valid', (SELECT approval_status FROM approval_staleness s JOIN approval a ON a.id = s.approval_id WHERE a.idempotency_key = 'k-o1'));
UPDATE evaluation SET superseded_at = now() WHERE id = of_test.eva();
SELECT of_test.eq('q2 approval voided after supersede', 'voided', (SELECT approval_status FROM approval_staleness s JOIN approval a ON a.id = s.approval_id WHERE a.idempotency_key = 'k-o1'));

-- (r)(s) operation log as the app
SELECT of_test.chk('r0 append 5', 'OK', $q$INSERT INTO operation_log (business_id, actor, action, outcome) SELECT of_test.ba(), 'agent', 'act-' || g, 'completed' FROM generate_series(1,5) g$q$, true);
SELECT of_test.eq('r1 verify', 'true/5', (SELECT ok::text || '/' || rows_checked FROM verify_operation_log(of_test.ba())));
SELECT of_test.chk('r2 forged seq/hash overwritten', 'OK', $q$
  INSERT INTO operation_log (business_id, seq, prev_hash, row_hash, created_at, actor, action, outcome)
  VALUES (of_test.ba(), 999, '\x00', sha256('x'), '2000-01-01', 'agent', 'forged', 'attempted')$q$, true);
SELECT of_test.eq('r2b chain still valid, seq 6', '6 true', (SELECT max(seq)::text FROM operation_log WHERE business_id = of_test.ba()) || ' ' || (SELECT ok::text FROM verify_operation_log(of_test.ba())));
SELECT of_test.chk('r3 app writes a platform row', 'ERR 42501', $q$INSERT INTO operation_log (business_id, actor, action, outcome) VALUES (NULL, 'system', 'x', 'completed')$q$);
SELECT of_test.eq('r4 verify of an invisible tenant reports 0 rows', '0', (SELECT rows_checked::text FROM verify_operation_log(of_test.bb())));
SELECT of_test.chk('s1 app UPDATE log', 'ERR 42501', $q$UPDATE operation_log SET action = 'x'$q$);
SELECT of_test.chk('s2 app DELETE log', 'ERR 42501', $q$DELETE FROM operation_log$q$);
SELECT of_test.chk('s3 app TRUNCATE log', 'ERR 42501', $q$TRUNCATE operation_log$q$);

-- (u) documents and extracted fields
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
     ('u1 size 25MB+1', 'ERR 23514', 'application/pdf', '26214401', 'u1'),
     ('u2 size 25MB', 'OK', 'application/pdf', '26214400', 'u2'),
     ('u3 size 0', 'ERR 23514', 'application/pdf', '0', 'u3'),
     ('u4 size -1', 'ERR 23514', 'application/pdf', '-1', 'u4'),
     ('u5 mime image/png', 'ERR 23514', 'image/png', '10', 'u5')) v(id, ex, mime, sz, h)
  LOOP
    PERFORM of_test.chk(r.id, r.ex, format($f$INSERT INTO document (business_id, deal_id, kind, content_hash, storage_key, original_filename, mime_type, size_bytes, uploaded_by)
      VALUES (of_test.ba(), of_test.da1(), 'po', sha256(%L), 'k', 'f', %L, %s, of_test.ua())$f$, r.h, r.mime, r.sz));
  END LOOP;
END $$;
SELECT of_test.chk('u6 duplicate sha in same deal (D-09)', 'ERR 23505', $q$
  INSERT INTO document (business_id, deal_id, kind, content_hash, storage_key, original_filename, mime_type, size_bytes, uploaded_by)
  VALUES (of_test.ba(), of_test.da1(), 'po', sha256('doca'), 'k', 'f', 'application/pdf', 10, of_test.ua())$q$);
SELECT of_test.chk('u7 same sha in another deal (stored once by hash)', 'OK', $q$
  INSERT INTO document (business_id, deal_id, kind, content_hash, storage_key, original_filename, mime_type, size_bytes, uploaded_by)
  VALUES (of_test.ba(), of_test.da2(), 'po', sha256('doca'), 'k1', 'f', 'application/pdf', 10, of_test.ua())$q$);
SELECT of_test.chk('u9 confidence -0.1', 'ERR 23514', $q$INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES (of_test.ba(), of_test.da1(), of_test.doca(), 'u9', '1', -0.1)$q$);
SELECT of_test.chk('u10 confidence 1.1', 'ERR 23514', $q$INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES (of_test.ba(), of_test.da1(), of_test.doca(), 'u10', '1', 1.1)$q$);
SELECT of_test.chk('u12 empty string value', 'ERR 23514', $q$INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES (of_test.ba(), of_test.da1(), of_test.doca(), 'u12', '""', 0.5)$q$);
SELECT of_test.chk('u13 JSON null value', 'ERR 23514', $q$INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES (of_test.ba(), of_test.da1(), of_test.doca(), 'u13', 'null', 0.5)$q$);
SELECT of_test.chk('u13b JSON null when missing', 'OK', $q$INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence, status) VALUES (of_test.ba(), of_test.da1(), of_test.doca(), 'u13b', 'null', 0, 'missing')$q$);
SELECT of_test.chk('u14 field citing a document of another deal', 'ERR 23503', $q$INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES (of_test.ba(), of_test.da1(), of_test.doca2(), 'u14', '1', 0.5)$q$);
SELECT of_test.chk('u15 status ambiguous / conflicting', 'OK', $q$
  INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence, status) VALUES
   (of_test.ba(), of_test.da1(), of_test.doca(), 'u15a', '"net 45"', 0.5, 'ambiguous'), (of_test.ba(), of_test.da1(), of_test.doca(), 'u15b', '1', 0.5, 'conflicting')$q$);

-- (v) privileges, function abuse, users
SELECT of_test.chk('v1 DROP TABLE', 'ERR 42501', $q$DROP TABLE deal$q$);
SELECT of_test.chk('v2 ALTER TABLE', 'ERR 42501', $q$ALTER TABLE deal ADD COLUMN zz int$q$);
SELECT of_test.chk('v3 TRUNCATE', 'ERR 42501', $q$TRUNCATE deal$q$);
SELECT of_test.chk('v4 CREATE in public', 'ERR 42501', $q$CREATE TABLE public.zz (i int)$q$);
SELECT of_test.chk('v5 read pg_authid', 'ERR 42501', $q$SELECT count(*) FROM pg_authid$q$);
SELECT of_test.chk('v6 DELETE deal', 'ERR 42501', $q$DELETE FROM deal$q$);
SELECT of_test.chk('v7 write reference data', 'ERR 42501', $q$INSERT INTO deal_transition VALUES ('ingesting','committed')$q$);
SELECT of_test.chk('v8 write cash_event_kind', 'ERR 42501', $q$INSERT INTO cash_event_kind VALUES ('bribe', false, 'x')$q$);
SELECT of_test.chk('v11 read password_hash', 'ERR 42501', $q$SELECT password_hash FROM app_user$q$);
SELECT of_test.chk('v12 set is_platform_admin', 'ERR 42501', $q$UPDATE app_user SET is_platform_admin = true WHERE id = of_test.uc()$q$);
SELECT of_test.chk('v12b insert a platform admin', 'ERR 42501', $q$INSERT INTO app_user (email, full_name, is_platform_admin) VALUES ('evil@example.test', 'E', true)$q$);
SELECT of_test.chk('v13 assign superadmin role', 'ERR OF009', $q$UPDATE membership SET role = 'superadmin' WHERE user_id = of_test.uc()$q$);
SELECT of_test.chk('v13b change a role (API checks the actor)', 'OK', $q$UPDATE membership SET role = 'risk_officer' WHERE user_id = of_test.uc()$q$);
SELECT of_test.chk('v17 app creates a TEMP table', 'ERR 42501', $q$CREATE TEMP TABLE deal_transition (from_status text, to_status text)$q$);
SELECT of_test.eq('v18 auth_lookup returns the hash for login', 'hash-a1', (SELECT password_hash FROM auth_lookup('Owner.A@example.test ')));
SELECT of_test.eq('v19 user_businesses across tenants', 'Biz A owner T3', (SELECT business_name || ' ' || role || ' ' || tier FROM user_businesses(of_test.ua())));
SELECT of_test.chk('v20 invite a user and read it back via app.user_id', 'OK', $q$
  SELECT set_config('app.user_id', 'a1000000-0000-4000-8000-0000000000aa', true);
  INSERT INTO app_user (id, email, full_name) VALUES ('a1000000-0000-4000-8000-0000000000aa', 'new@example.test', 'New') RETURNING id, email$q$);

-- (y) text
SELECT of_test.chk('y1 Bangla/emoji/RTL', 'OK', $q$
  INSERT INTO customer (business_id, name) VALUES (of_test.ba(), 'বাংলা গ্রাহক 😀 עברית');
  DO $d$ BEGIN IF NOT EXISTS (SELECT 1 FROM customer WHERE name = 'বাংলা গ্রাহক 😀 עברית') THEN RAISE EXCEPTION 'round trip'; END IF; END $d$$q$);
SELECT of_test.chk('y2 body at the 100000-char cap', 'OK', $q$INSERT INTO negotiation_message (business_id, deal_id, round, direction, counterparty_kind, body) VALUES (of_test.ba(), of_test.da2(), 0, 'outbound', 'customer', repeat('ক', 100000))$q$);
SELECT of_test.chk('y3 body over the cap', 'ERR 23514', $q$INSERT INTO negotiation_message (business_id, deal_id, round, direction, counterparty_kind, body) VALUES (of_test.ba(), of_test.da2(), 0, 'outbound', 'customer', repeat('a', 100001))$q$);
SELECT of_test.chk('y4 NUL in text', 'ERR 54000', $q$INSERT INTO customer (business_id, name) VALUES (of_test.ba(), 'a' || chr(0) || 'b')$q$);
SELECT of_test.chk('y5 \u0000 in jsonb', 'ERR 22P05', $q$INSERT INTO extracted_field (business_id, deal_id, document_id, field, value, confidence) VALUES (of_test.ba(), of_test.da1(), of_test.doca(), 'y5', '"a\u0000b"', 0.5)$q$);
SELECT of_test.chk('y6 injection-looking text stored verbatim', 'OK', $q$
  INSERT INTO customer (business_id, name) VALUES (of_test.ba(), 'Robert''); DROP TABLE deal; --');
  DO $d$ BEGIN IF NOT EXISTS (SELECT 1 FROM customer WHERE name = 'Robert''); DROP TABLE deal; --') THEN RAISE EXCEPTION 'not verbatim'; END IF; END $d$$q$);

-- ======================================================================= orderfit_readonly
RESET ROLE;
SET ROLE orderfit_readonly;
SELECT set_config('app.business_id', of_test.ba()::text, false);
SELECT of_test.chk('w1 readonly INSERT', 'ERR 42501', $q$INSERT INTO customer (business_id, name) VALUES (of_test.ba(), 'ro')$q$);
SELECT of_test.chk('w2 readonly UPDATE', 'ERR 42501', $q$UPDATE deal SET po_number = 'x'$q$);
SELECT of_test.chk('w3 readonly DELETE', 'ERR 42501', $q$DELETE FROM deal$q$);
SELECT of_test.chk('w4 readonly password_hash', 'ERR 42501', $q$SELECT password_hash FROM app_user$q$);
SELECT of_test.chk('w5 readonly auth_lookup', 'ERR 42501', $q$SELECT * FROM auth_lookup('owner.a@example.test')$q$);
SELECT of_test.eq('w6 readonly sees only tenant A', '0', (SELECT count(*)::text FROM deal WHERE business_id <> of_test.ba()));

-- ======================================================================= orderfit_admin
RESET ROLE;
SET ROLE orderfit_admin;
SELECT set_config('app.business_id', '', false);
SELECT of_test.eq('ad1 admin role sees every tenant', '2', (SELECT count(DISTINCT business_id)::text FROM deal WHERE business_id IN (of_test.ba(), of_test.bb())));
SELECT of_test.chk('ad2 admin is still bound by workflow rules', 'ERR OF008', $q$
  INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by, status, closed_at) VALUES (of_test.ba(), 'X-ad2', of_test.custa(), of_test.ca(), of_test.ua(), 'committed', now())$q$);

-- ======================================================================= superuser checks
RESET ROLE;
SELECT of_test.chk('S1 UPDATE evaluation', 'ERR 23000', $q$UPDATE evaluation SET verdict = 'feasible_as_offered' WHERE id = of_test.evb()$q$);
SELECT of_test.chk('S2 DELETE evaluation', 'ERR 23000', $q$DELETE FROM evaluation WHERE id = of_test.evb()$q$);
SELECT of_test.chk('S3 UPDATE evaluation_option', 'ERR 23000', $q$UPDATE evaluation_option SET cost_minor = 1$q$);
SELECT of_test.chk('S4 UPDATE approval', 'ERR 23000', $q$UPDATE approval SET decision = 'rejected'$q$);
SELECT of_test.chk('S5 UPDATE owner_constraints', 'ERR 23000', $q$UPDATE owner_constraints SET safety_reserve_minor = 1$q$);
SELECT of_test.chk('S6 UPDATE log', 'ERR 23000', $q$UPDATE operation_log SET action = 'x'$q$);
SELECT of_test.chk('S7 DELETE log', 'ERR 23000', $q$DELETE FROM operation_log$q$);
SELECT of_test.chk('S8 TRUNCATE log', 'ERR 23000', $q$TRUNCATE operation_log$q$);
SET CONSTRAINTS ALL IMMEDIATE;   -- flush pending deferred FK checks, or TRUNCATE refuses with 55006 before the guard runs
SELECT of_test.chk('S9 TRUNCATE approval CASCADE', 'ERR 23000', $q$TRUNCATE approval CASCADE$q$);
SELECT of_test.chk('S10 TRUNCATE evaluation CASCADE', 'ERR 23000', $q$TRUNCATE evaluation CASCADE$q$);
SELECT of_test.chk('S11 TRUNCATE deal CASCADE', 'ERR 23000', $q$TRUNCATE deal CASCADE$q$);
SELECT of_test.chk('S12 DELETE execution_action', 'ERR 23000', $q$DELETE FROM execution_action$q$);

-- temp-table shadowing: tables created by a role that CAN create temp tables must not be seen by the triggers
SELECT of_test.chk('v14 shadowed deal_transition does not open an illegal jump', 'ERR OF001', $q$
  CREATE TEMP TABLE deal_transition (from_status text, to_status text);
  INSERT INTO pg_temp.deal_transition VALUES ('ingesting', 'committed');
  SELECT of_test.mkdeal(of_test.t(), 'ingesting');
  UPDATE public.deal SET status = 'committed' WHERE id = of_test.t()$q$);
SELECT of_test.chk('v15 shadowed deal_flag does not bypass the gate', 'ERR OF002', $q$
  SELECT of_test.mkdeal(of_test.t(), 'awaiting_confirm');
  INSERT INTO public.deal_flag (business_id, deal_id, kind, code, message, blocking, raised_by) VALUES (of_test.ba(), of_test.t(), 'fraud', 'SEC-FRAUD', 'm', true, 'system');
  CREATE TEMP TABLE deal_flag (deal_id uuid, blocking boolean, resolved_at timestamptz);
  UPDATE public.deal SET status = 'computing' WHERE id = of_test.t()$q$);
SELECT of_test.chk('v16 shadowed operation_log does not fork the chain', 'OK', $q$
  CREATE TEMP TABLE operation_log (scope uuid, seq bigint, row_hash bytea);
  INSERT INTO pg_temp.operation_log SELECT scope, max(seq), sha256('evil') FROM public.operation_log WHERE scope = of_test.ba() GROUP BY scope;
  INSERT INTO public.operation_log (business_id, actor, action, outcome) VALUES (of_test.ba(), 'agent', 'shadowed', 'completed');
  DROP TABLE pg_temp.operation_log;
  DO $d$ BEGIN IF NOT (SELECT ok FROM public.verify_operation_log(of_test.ba())) THEN RAISE EXCEPTION 'chain broken'; END IF; END $d$$q$);

-- tamper detection (superuser disables the guard inside a rolled-back subtransaction)
SELECT of_test.chk('r5 edited row is detected at its seq', 'OK', $q$
  ALTER TABLE operation_log DISABLE TRIGGER operation_log_no_edit;
  UPDATE operation_log SET payload = '{"x":1}' WHERE business_id = of_test.ba() AND seq = 3;
  DO $d$ BEGIN IF (SELECT broken_seq FROM verify_operation_log(of_test.ba())) IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'not detected at 3'; END IF; END $d$$q$);
SELECT of_test.chk('r6 deleted middle row is detected', 'OK', $q$
  ALTER TABLE operation_log DISABLE TRIGGER operation_log_no_edit;
  DELETE FROM operation_log WHERE business_id = of_test.ba() AND seq = 2;
  DO $d$ BEGIN IF (SELECT ok FROM verify_operation_log(of_test.ba())) THEN RAISE EXCEPTION 'not detected'; END IF; END $d$$q$);

-- Rina R-01 / R-02 reproduced from stored rows (fixtures/cases/RINA.json, USD cents)
INSERT INTO business (id, name, currency) VALUES ('d0000000-0000-4000-8000-000000000000', 'Rina', 'USD');
INSERT INTO app_user (id, email, full_name, status) VALUES ('d1000000-0000-4000-8000-000000000001', 'rina@example.test', 'Rina', 'active');
INSERT INTO membership VALUES ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000000', 'owner');
INSERT INTO owner_constraints (id, business_id, version, safety_reserve_minor, created_by) VALUES ('d2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000000', 1, 500000, 'd1000000-0000-4000-8000-000000000001');
INSERT INTO customer (id, business_id, name) VALUES ('d3000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000000', 'Rina customer');
INSERT INTO deal (id, business_id, public_ref, customer_id, constraints_id, created_by, start_date, opening_cash_minor, order_value_minor, delivery_date, payment_days, payment_basis)
VALUES ('d5000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000000', 'RINA', 'd3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001',
        'd1000000-0000-4000-8000-000000000001', '2026-03-02', 2500000, 3000000, '2026-03-30', 30, 'delivery');
INSERT INTO cash_event (business_id, deal_id, event_date, amount_minor, direction, kind, incremental, certainty)
SELECT 'd0000000-0000-4000-8000-000000000000', CASE WHEN s.o THEN 'd5000000-0000-4000-8000-000000000001'::uuid END, s.d::date, s.a, s.dir, s.k, s.o, 'confirmed'
FROM (VALUES ('2026-03-17',800000,'out','payroll',false), ('2026-04-01',800000,'out','payroll',false), ('2026-04-16',800000,'out','payroll',false),
             ('2026-05-01',800000,'out','payroll',false), ('2026-05-16',800000,'out','payroll',false), ('2026-03-22',1000000,'in','ar_collection',false),
             ('2026-04-11',1000000,'in','ar_collection',false), ('2026-05-11',1000000,'in','ar_collection',false),
             ('2026-03-03',1200000,'out','supplier_payment',true), ('2026-03-27',500000,'out','supplier_payment',true)) s(d, a, dir, k, o);
INSERT INTO cash_event (business_id, deal_id, event_date, amount_minor, direction, kind)
SELECT business_id, id, delivery_date + payment_days, order_value_minor, 'in', 'order_final_receipt' FROM deal WHERE public_ref = 'RINA';
CREATE TEMP VIEW rina_sim AS
WITH ev AS (SELECT e.*, d.opening_cash_minor op FROM engine_input_events e JOIN deal d ON d.id = e.deal_id WHERE d.public_ref = 'RINA'),
     steps AS (SELECT day, apply_order, is_baseline, op,
                      sum(CASE direction WHEN 'in' THEN amount_minor ELSE -amount_minor END) AS delta FROM ev GROUP BY day, apply_order, is_baseline, op),
     base AS (SELECT day, apply_order, op + sum(delta) OVER (ORDER BY day, apply_order) AS bal FROM steps WHERE is_baseline),
     allv AS (SELECT day, apply_order, op + sum(sum(delta)) OVER (ORDER BY day, apply_order) AS bal FROM steps GROUP BY day, apply_order, op)
SELECT 'base' AS run, day, bal FROM base UNION ALL SELECT 'all', day, bal FROM allv;
SELECT of_test.eq('R1 Rina baseline lowest 13,000 on day 60', '1300000@60', (SELECT bal || '@' || day FROM rina_sim WHERE run = 'base' ORDER BY bal, day LIMIT 1));
SELECT of_test.eq('R2 Rina accept-as-offered lowest 2,000 on day 30', '200000@30', (SELECT bal || '@' || day FROM rina_sim WHERE run = 'all' ORDER BY bal, day LIMIT 1));

-- catalog hygiene
SELECT of_test.eq('H1 public functions without a pinned search_path', '0',
  (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace
     AND NOT coalesce(array_to_string(proconfig, ',') LIKE '%search_path=%', false)));
-- Exact inventories for both supported revisions; behavior checks above are unchanged.
SELECT of_test.eq('H2 SECURITY DEFINER functions', CASE WHEN to_regclass('public.operation') IS NULL
  THEN 'auth_lookup,user_businesses'
  WHEN to_regclass('public.commitment_settlement') IS NULL
  THEN 'auth_lookup,auth_rate_consume,auth_request_complete,auth_request_reserve,operation_claim,operation_context,operation_finish,operation_heartbeat,owner_provision,security_record,session_csrf,session_issue,session_password,session_resolve,session_revoke,user_businesses'
  WHEN to_regclass('public.auth_passkey') IS NOT NULL THEN 'auth_lookup,auth_rate_consume,auth_rate_release,auth_request_complete,auth_request_reserve,invitation_accept,operation_claim,operation_context,operation_finish,operation_heartbeat,operation_settle_context,owner_provision,p6_run_actor_current,p7_caller_session_current,p7_event_notification,p7_notify,p7_queue_backlog_seconds,passkey_authenticated,passkey_begin,passkey_enrolled,passkey_required,passkey_take,security_record,session_authority_current,session_csrf,session_issue,session_password,session_resolve,session_revoke,user_businesses,worker_capacity_live,worker_presence_publish'
  WHEN to_regprocedure('public.auth_rate_release(bytea)') IS NOT NULL
  THEN CASE WHEN to_regprocedure('public.session_authority_current(uuid,uuid)') IS NOT NULL
    THEN 'auth_lookup,auth_rate_consume,auth_rate_release,auth_request_complete,auth_request_reserve,invitation_accept,operation_claim,operation_context,operation_finish,operation_heartbeat,operation_settle_context,owner_provision,p6_run_actor_current,p7_caller_session_current,p7_event_notification,p7_notify,p7_queue_backlog_seconds,security_record,session_authority_current,session_csrf,session_issue,session_password,session_resolve,session_revoke,user_businesses' || CASE WHEN to_regclass('public.worker_presence') IS NOT NULL THEN ',worker_capacity_live,worker_presence_publish' ELSE '' END
    ELSE 'auth_lookup,auth_rate_consume,auth_rate_release,auth_request_complete,auth_request_reserve,invitation_accept,operation_claim,operation_context,operation_finish,operation_heartbeat,operation_settle_context,owner_provision,p6_run_actor_current,p7_caller_session_current,p7_event_notification,p7_notify,p7_queue_backlog_seconds,security_record,session_csrf,session_issue,session_password,session_resolve,session_revoke,user_businesses' END
  WHEN to_regclass('public.membership_invitation') IS NOT NULL
  THEN 'auth_lookup,auth_rate_consume,auth_request_complete,auth_request_reserve,invitation_accept,operation_claim,operation_context,operation_finish,operation_heartbeat,owner_provision,p6_run_actor_current,p7_caller_session_current,p7_event_notification,p7_notify,p7_queue_backlog_seconds,security_record,session_csrf,session_issue,session_password,session_resolve,session_revoke,user_businesses'
  ELSE 'auth_lookup,auth_rate_consume,auth_request_complete,auth_request_reserve,operation_claim,operation_context,operation_finish,operation_heartbeat,owner_provision,p6_run_actor_current,security_record,session_csrf,session_issue,session_password,session_resolve,session_revoke,user_businesses' END,
  (SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef));
SELECT of_test.eq('H3 tables without a primary key', '0',
  (SELECT count(*)::text FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
     AND c.relname <> 'alembic_version' AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p')));
SELECT of_test.eq('H4 timestamp without time zone columns', '0',
  (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'));
SELECT of_test.eq('H5 tenant tables with RLS forced', ((CASE WHEN to_regclass('public.evaluation_series') IS NOT NULL THEN 30 WHEN to_regclass('public.operation') IS NULL THEN 22 ELSE 29 END) + (CASE WHEN to_regclass('public.decision_export') IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN to_regclass('public.document_parse') IS NOT NULL THEN 5 ELSE 0 END) + (CASE WHEN to_regclass('public.prepared_message') IS NOT NULL THEN 5 ELSE 0 END) + (CASE WHEN to_regclass('public.action_bundle') IS NOT NULL THEN 8 ELSE 0 END) + (CASE WHEN to_regclass('public.commitment_settlement') IS NOT NULL THEN 3 ELSE 0 END) + (CASE WHEN to_regclass('public.membership_invitation') IS NOT NULL THEN 3 ELSE 0 END) + (CASE WHEN to_regclass('public.worker_presence') IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN to_regclass('public.auth_passkey') IS NOT NULL THEN 2 ELSE 0 END))::text,
  (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity AND relforcerowsecurity));
SELECT of_test.eq('H6 tenant policies that are a plain equality', ((CASE WHEN to_regclass('public.evaluation_series') IS NOT NULL THEN 26 WHEN to_regclass('public.operation') IS NULL THEN 22 ELSE 25 END) + (CASE WHEN to_regclass('public.decision_export') IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN to_regclass('public.document_parse') IS NOT NULL THEN 5 ELSE 0 END) + (CASE WHEN to_regclass('public.prepared_message') IS NOT NULL THEN 5 ELSE 0 END) + (CASE WHEN to_regclass('public.action_bundle') IS NOT NULL THEN 8 ELSE 0 END) + (CASE WHEN to_regclass('public.commitment_settlement') IS NOT NULL THEN 3 ELSE 0 END) + (CASE WHEN to_regclass('public.membership_invitation') IS NOT NULL THEN 2 ELSE 0 END))::text,
  (SELECT count(*)::text FROM pg_policies WHERE policyname = 'tenant_isolation' AND qual LIKE '%= ( SELECT app_business_id()%' AND qual NOT LIKE '% OR %'));

-- ======================================================================= report
\echo
\echo '---- failing checks (empty = none) ----'
SELECT id, expect, actual FROM of_test.results WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS passed, count(*) FILTER (WHERE NOT pass) AS failed, count(*) AS total FROM of_test.results \gset
\echo :passed passed / :failed failed / :total total
ROLLBACK;
SELECT (:failed > 0) AS has_failures \gset
\if :has_failures
  \echo 'SCHEMA TEST FAILED'
  SELECT 1 / 0 AS schema_test_failed;
\else
  \echo 'SCHEMA TEST PASSED'
\endif
