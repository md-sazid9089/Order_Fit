-- Integrity triggers, the tamper-evident operation log, and the views the API/engine read.
--
-- Every function pins its search_path. Without that, a session could create a TEMP table named
-- deal_transition / deal_flag / operation_log, which pg_temp would resolve FIRST inside the
-- trigger, and bypass the state machine, the blocking-flag gate or the hash chain.
--
-- SQLSTATEs raised here (the API maps them to HTTP; see docs/database/database.md):
--   OF001 illegal deal status transition          OF006 message status rule
--   OF002 unresolved blocking flags                OF007 execution action rule
--   OF003 deal inputs frozen after confirmation    OF008 workflow entry rule (INSERT)
--   OF004 negotiation round rule                   OF009 privilege rule (role assignment)
--   OF005 approval rule (approver, tier, stale evaluation, message state)
--   23000 append-only / immutable table

-- ---------------------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------------------
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END $$;

-- true when the current role acts with orderfit_app's privileges (the API / agent), i.e. the
-- workflow rules apply. Migrations, seeds and superusers are not restricted.
-- 'USAGE' (not 'MEMBER'): on PG16 the role that CREATED orderfit_app holds an implicit,
-- non-inheriting admin membership, which must not count.
CREATE FUNCTION app_is_restricted() RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orderfit_app')
     AND pg_has_role(current_user, 'orderfit_app', 'USAGE')
     AND NOT coalesce((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false)
$$;

CREATE TRIGGER business_touch  BEFORE UPDATE ON business  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER app_user_touch  BEFORE UPDATE ON app_user  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Immutable / append-only tables
CREATE TRIGGER owner_constraints_append_only BEFORE UPDATE OR DELETE ON owner_constraints
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER approval_append_only BEFORE UPDATE OR DELETE ON approval
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER evaluation_option_append_only BEFORE UPDATE OR DELETE ON evaluation_option
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- No TRUNCATE on any financial / evidential table, for anyone (including owners and superusers).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['business','membership','customer','customer_invoice','payee','payee_bank_account',
    'owner_constraints','financing_offer','deal','document','extracted_field','cash_event','evaluation',
    'evaluation_option','deal_flag','negotiation_message','approval','execution_action']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_change()',
                   t || '_no_truncate', t);
  END LOOP;
END $$;

-- evaluation: the only permitted change is stamping superseded_at (once).
CREATE FUNCTION evaluation_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on evaluation is not allowed' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (to_jsonb(NEW) - 'superseded_at') IS DISTINCT FROM (to_jsonb(OLD) - 'superseded_at')
     OR (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at) THEN
    RAISE EXCEPTION 'evaluation rows are immutable; only superseded_at may be set, once'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evaluation_immutable BEFORE UPDATE OR DELETE ON evaluation
  FOR EACH ROW EXECUTE FUNCTION evaluation_guard();

-- evaluation INSERT: belongs to the deal's current negotiation round; the API may only
-- store a result while the deal is computing.
CREATE FUNCTION evaluation_insert_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE d record;
BEGIN
  SELECT status, negotiation_round INTO d FROM public.deal WHERE business_id = NEW.business_id AND id = NEW.deal_id;
  IF FOUND AND NEW.round <> d.negotiation_round THEN
    RAISE EXCEPTION 'evaluation round % does not match the deal''s negotiation round %', NEW.round, d.negotiation_round
      USING ERRCODE = 'OF004';
  END IF;
  IF FOUND AND app_is_restricted() AND d.status <> 'computing' THEN
    RAISE EXCEPTION 'an evaluation can only be stored while the deal is computing (status %)', d.status
      USING ERRCODE = 'OF008';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evaluation_insert_bi BEFORE INSERT ON evaluation
  FOR EACH ROW EXECUTE FUNCTION evaluation_insert_guard();

-- ---------------------------------------------------------------------------------------
-- Deal: defaults, workflow entry, optimistic lock, state machine, blocking-flag gate
-- ---------------------------------------------------------------------------------------
CREATE FUNCTION deal_defaults() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.owner_constraints;
BEGIN
  IF app_is_restricted() AND (NEW.status <> 'ingesting' OR NEW.negotiation_round <> 0 OR NEW.closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'a deal must be created in status ingesting, round 0 (got %, round %)', NEW.status, NEW.negotiation_round
      USING ERRCODE = 'OF008';
  END IF;
  NEW.version := 1;
  SELECT * INTO c FROM public.owner_constraints WHERE business_id = NEW.business_id AND id = NEW.constraints_id;
  IF FOUND THEN
    NEW.reserve_minor                  := coalesce(NEW.reserve_minor, c.safety_reserve_minor);
    NEW.deposit_discount_bps           := coalesce(NEW.deposit_discount_bps, c.deposit_discount_bps);
    NEW.deposit_discount_bps_per_10pct := coalesce(NEW.deposit_discount_bps_per_10pct, c.deposit_discount_bps_per_10pct);
  END IF;
  IF NEW.currency IS NULL THEN
    SELECT currency INTO NEW.currency FROM public.business WHERE id = NEW.business_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deal_defaults_bi BEFORE INSERT ON deal FOR EACH ROW EXECUTE FUNCTION deal_defaults();

CREATE FUNCTION deal_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.version    := OLD.version + 1;
  NEW.updated_at := now();

  -- status may only follow an edge listed in deal_transition (terminal states have none)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (SELECT 1 FROM public.deal_transition WHERE from_status = OLD.status AND to_status = NEW.status) THEN
      RAISE EXCEPTION 'illegal deal status transition % -> %', OLD.status, NEW.status
        USING ERRCODE = 'OF001';
    END IF;
    -- an unresolved BLOCKING flag (ambiguity, injection, fraud ...) stops the deal going forward
    IF NEW.status IN ('computing','awaiting_approval','awaiting_reply','committed')
       AND EXISTS (SELECT 1 FROM public.deal_flag WHERE deal_id = NEW.id AND blocking AND resolved_at IS NULL) THEN
      RAISE EXCEPTION 'deal % has unresolved blocking flags; resolve them before moving to %', NEW.public_ref, NEW.status
        USING ERRCODE = 'OF002';
    END IF;
    IF NEW.status IN ('committed','closed') AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  END IF;

  -- the negotiation round counts up one step at a time, never down
  IF NEW.negotiation_round NOT IN (OLD.negotiation_round, OLD.negotiation_round + 1) THEN
    RAISE EXCEPTION 'negotiation_round may only stay or increase by 1 (% -> %)', OLD.negotiation_round, NEW.negotiation_round
      USING ERRCODE = 'OF004';
  END IF;

  -- every engine input is frozen once the deal is past confirmation. To change one, move the
  -- deal back to awaiting_confirm (allowed from awaiting_approval and awaiting_reply), edit,
  -- and re-confirm: that produces a new evaluation and makes old approvals stale.
  IF OLD.status NOT IN ('ingesting','awaiting_confirm','failed')
     AND (NEW.opening_cash_minor             IS DISTINCT FROM OLD.opening_cash_minor
       OR NEW.reserve_minor                  IS DISTINCT FROM OLD.reserve_minor
       OR NEW.constraints_id                 IS DISTINCT FROM OLD.constraints_id
       OR NEW.target_scenario                IS DISTINCT FROM OLD.target_scenario
       OR NEW.order_value_minor              IS DISTINCT FROM OLD.order_value_minor
       OR NEW.start_date                     IS DISTINCT FROM OLD.start_date
       OR NEW.order_date                     IS DISTINCT FROM OLD.order_date
       OR NEW.invoice_date                   IS DISTINCT FROM OLD.invoice_date
       OR NEW.delivery_date                  IS DISTINCT FROM OLD.delivery_date
       OR NEW.payment_days                   IS DISTINCT FROM OLD.payment_days
       OR NEW.payment_basis                  IS DISTINCT FROM OLD.payment_basis
       OR NEW.deposit_discount_bps           IS DISTINCT FROM OLD.deposit_discount_bps
       OR NEW.deposit_discount_bps_per_10pct IS DISTINCT FROM OLD.deposit_discount_bps_per_10pct
       OR NEW.customer_id                    IS DISTINCT FROM OLD.customer_id
       OR NEW.currency                       IS DISTINCT FROM OLD.currency
       OR NEW.business_id                    IS DISTINCT FROM OLD.business_id
       OR NEW.created_by                     IS DISTINCT FROM OLD.created_by) THEN
    RAISE EXCEPTION 'deal inputs are frozen after confirmation (status %); move the deal back to awaiting_confirm to edit', OLD.status
      USING ERRCODE = 'OF003';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deal_guard_bu BEFORE UPDATE ON deal FOR EACH ROW EXECUTE FUNCTION deal_guard();

-- ---------------------------------------------------------------------------------------
-- Messages: body hash (what an approval pins) and status rules
-- ---------------------------------------------------------------------------------------
-- Recomputed on EVERY insert/update, so a caller can never store a hash that differs from the body.
CREATE FUNCTION message_hash() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.body_sha256 := sha256(convert_to(NEW.body, 'UTF8'));
  RETURN NEW;
END $$;
CREATE TRIGGER message_hash_biu BEFORE INSERT OR UPDATE ON negotiation_message
  FOR EACH ROW EXECUTE FUNCTION message_hash();

CREATE FUNCTION message_status_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.direction = 'outbound' AND NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'an outbound message starts as draft (got %)', NEW.status USING ERRCODE = 'OF006';
    END IF;
    RETURN NEW;
  END IF;
  -- once a message is approved, sent, received or discarded its content is evidence
  IF OLD.status <> 'draft' AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.subject IS DISTINCT FROM OLD.subject
                                OR NEW.direction IS DISTINCT FROM OLD.direction OR NEW.deal_id IS DISTINCT FROM OLD.deal_id) THEN
    RAISE EXCEPTION 'message content is frozen once it is %', OLD.status USING ERRCODE = 'OF006';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status = 'draft'    AND NEW.status IN ('approved','discarded'))
         OR (OLD.status = 'approved' AND NEW.status IN ('sent','discarded'))) THEN
      RAISE EXCEPTION 'illegal message status transition % -> %', OLD.status, NEW.status USING ERRCODE = 'OF006';
    END IF;
    IF NEW.status IN ('approved','sent') AND NOT EXISTS (
         SELECT 1 FROM public.approval a
         WHERE a.business_id = NEW.business_id AND a.message_id = NEW.id AND a.action = 'send_message'
           AND a.decision IN ('approved','edited') AND a.message_sha256 = NEW.body_sha256) THEN
      RAISE EXCEPTION 'message % has no send_message approval for its current body', NEW.id USING ERRCODE = 'OF006';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER message_status_biu BEFORE INSERT OR UPDATE ON negotiation_message
  FOR EACH ROW EXECUTE FUNCTION message_status_guard();

-- ---------------------------------------------------------------------------------------
-- Approvals: who may approve what, and only against a live evaluation
-- ---------------------------------------------------------------------------------------
CREATE FUNCTION approval_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_tier text; v_user_status text; v_ev_superseded timestamptz; v_msg record;
BEGIN
  SELECT u.status INTO v_user_status FROM public.app_user u WHERE u.id = NEW.approver_id;
  IF v_user_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'approver % is not an active user', NEW.approver_id USING ERRCODE = 'OF005';
  END IF;
  SELECT r.tier INTO v_tier FROM public.membership m JOIN public.app_role r ON r.code = m.role
   WHERE m.user_id = NEW.approver_id AND m.business_id = NEW.business_id;
  IF NEW.decision <> 'rejected' THEN
    IF NEW.action = 'confirm_figures' AND v_tier NOT IN ('T2','T3','T4') THEN
      RAISE EXCEPTION 'confirming figures needs tier T2 or above (approver has %)', v_tier USING ERRCODE = 'OF005';
    END IF;
    IF NEW.action IN ('send_message','commit_plan','compensate','override') AND v_tier NOT IN ('T3','T4') THEN
      RAISE EXCEPTION '% needs tier T3 or above (approver has %)', NEW.action, v_tier USING ERRCODE = 'OF005';
    END IF;
    IF NEW.evaluation_id IS NOT NULL THEN
      SELECT superseded_at INTO v_ev_superseded FROM public.evaluation WHERE id = NEW.evaluation_id;
      IF v_ev_superseded IS NOT NULL THEN
        RAISE EXCEPTION 'evaluation % is superseded (stale); re-approve against the current one', NEW.evaluation_id
          USING ERRCODE = 'OF005';
      END IF;
    END IF;
    IF NEW.action = 'send_message' THEN
      SELECT direction, status INTO v_msg FROM public.negotiation_message WHERE id = NEW.message_id;
      IF v_msg.direction IS DISTINCT FROM 'outbound' OR v_msg.status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'only an outbound draft can be approved for sending (message is % %)', v_msg.direction, v_msg.status
          USING ERRCODE = 'OF005';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER approval_guard_bi BEFORE INSERT ON approval FOR EACH ROW EXECUTE FUNCTION approval_guard();

-- ---------------------------------------------------------------------------------------
-- Execution actions: immutable payload, status machine, approval binding
-- ---------------------------------------------------------------------------------------
CREATE FUNCTION execution_action_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; v_ev_superseded timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'drafted' THEN
      RAISE EXCEPTION 'an execution action starts as drafted (got %)', NEW.status USING ERRCODE = 'OF007';
    END IF;
  ELSE
    IF NEW.business_id IS DISTINCT FROM OLD.business_id OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
       OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.payee_id IS DISTINCT FROM OLD.payee_id
       OR NEW.message_id IS DISTINCT FROM OLD.message_id OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.plan_hash IS DISTINCT FROM OLD.plan_hash OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR (OLD.approval_id IS NOT NULL AND NEW.approval_id IS DISTINCT FROM OLD.approval_id) THEN
      RAISE EXCEPTION 'execution action % is immutable after drafting (only status / approval / outcome may change)', OLD.id
        USING ERRCODE = 'OF007';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
         (OLD.status = 'drafted'   AND NEW.status IN ('scheduled','voided','cancelled'))
      OR (OLD.status = 'scheduled' AND NEW.status IN ('sent','posted','accepted','cancelled','failed','voided'))
      OR (OLD.status = 'failed'    AND NEW.status IN ('scheduled','voided'))) THEN
      RAISE EXCEPTION 'illegal execution status transition % -> %', OLD.status, NEW.status USING ERRCODE = 'OF007';
    END IF;
    NEW.updated_at := now();
    IF NEW.status IN ('sent','posted','accepted') AND NEW.executed_at IS NULL THEN NEW.executed_at := now(); END IF;
  END IF;

  -- anything past drafted must be covered by a valid approval for exactly this plan
  IF NEW.status IN ('scheduled','sent','posted','accepted') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO a FROM public.approval WHERE id = NEW.approval_id AND business_id = NEW.business_id AND deal_id = NEW.deal_id;
    IF NOT FOUND OR a.decision NOT IN ('approved','edited') OR a.action NOT IN ('send_message','commit_plan','compensate') THEN
      RAISE EXCEPTION 'execution needs an approved send/commit/compensate approval for this deal' USING ERRCODE = 'OF007';
    END IF;
    IF a.action_plan_hash IS DISTINCT FROM NEW.plan_hash THEN
      RAISE EXCEPTION 'approval plan hash does not match the action''s plan hash' USING ERRCODE = 'OF007';
    END IF;
    IF a.expires_at IS NOT NULL AND a.expires_at <= now() THEN
      RAISE EXCEPTION 'approval % has expired', a.id USING ERRCODE = 'OF007';
    END IF;
    IF a.evaluation_id IS NOT NULL THEN
      SELECT superseded_at INTO v_ev_superseded FROM public.evaluation WHERE id = a.evaluation_id;
      IF v_ev_superseded IS NOT NULL THEN
        RAISE EXCEPTION 'approval % is stale: its evaluation was superseded', a.id USING ERRCODE = 'OF007';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER execution_action_guard_biu BEFORE INSERT OR UPDATE ON execution_action
  FOR EACH ROW EXECUTE FUNCTION execution_action_guard();
CREATE TRIGGER execution_action_no_delete BEFORE DELETE ON execution_action
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- ---------------------------------------------------------------------------------------
-- Membership: the application cannot hand out the platform role
-- ---------------------------------------------------------------------------------------
CREATE FUNCTION membership_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF app_is_restricted() AND NEW.role = 'superadmin' THEN
    RAISE EXCEPTION 'the superadmin role is assigned by the platform, not by the application' USING ERRCODE = 'OF009';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.business_id IS DISTINCT FROM OLD.business_id) THEN
    RAISE EXCEPTION 'a membership cannot be moved to another user or business' USING ERRCODE = 'OF009';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER membership_guard_biu BEFORE INSERT OR UPDATE ON membership
  FOR EACH ROW EXECUTE FUNCTION membership_guard();

-- ---------------------------------------------------------------------------------------
-- Operation log: append-only, hash-chained per business (platform events: business_id NULL).
-- seq, prev_hash, row_hash and created_at are assigned HERE, under a per-scope advisory lock,
-- so callers cannot forge them and concurrent writers cannot fork the chain.
-- Write it under READ COMMITTED (the default): under REPEATABLE READ concurrent writers see an
-- old head and fail with 23505 on (scope, seq) - safe, but the write is lost unless retried.
-- ---------------------------------------------------------------------------------------
CREATE TABLE operation_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id   uuid REFERENCES business(id),
  scope         uuid GENERATED ALWAYS AS (coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  seq           bigint NOT NULL,
  deal_id       uuid,
  actor         text NOT NULL CHECK (actor IN ('owner','agent','engine','system')),
  actor_user_id uuid REFERENCES app_user(id),
  tier          text CHECK (tier IN ('T0','T1','T2','T3','T4')),
  action        text NOT NULL CHECK (btrim(action) <> '' AND length(action) <= 200),
  entity        text CHECK (length(entity) <= 500),
  outcome       text NOT NULL CHECK (outcome IN ('attempted','completed','blocked','confirmed','failed')),
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash     bytea NOT NULL,
  row_hash      bytea NOT NULL CHECK (octet_length(row_hash) = 32),
  created_at    timestamptz NOT NULL,
  UNIQUE (scope, seq),
  FOREIGN KEY (business_id, deal_id) REFERENCES deal (business_id, id)
);
CREATE INDEX operation_log_deal_idx ON operation_log (deal_id, seq);
CREATE INDEX operation_log_actor_user_idx ON operation_log (actor_user_id) WHERE actor_user_id IS NOT NULL;

CREATE FUNCTION operation_log_canonical(r operation_log) RETURNS text LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  -- jsonb text output is deterministic, and a JSON array is unambiguous (no delimiter tricks)
  SELECT jsonb_build_array(r.seq, r.business_id, r.deal_id, r.actor, r.actor_user_id, r.tier,
                           r.action, r.entity, r.outcome, r.payload,
                           to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text
$$;

CREATE FUNCTION operation_log_chain() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_scope uuid := coalesce(NEW.business_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_prev  bytea;
  v_seq   bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('operation_log:' || v_scope::text, 0));
  SELECT seq, row_hash INTO v_seq, v_prev
    FROM public.operation_log WHERE scope = v_scope ORDER BY seq DESC LIMIT 1;
  IF NOT FOUND THEN
    v_seq  := 0;
    v_prev := decode(repeat('00', 32), 'hex');         -- genesis
  END IF;
  NEW.seq        := v_seq + 1;
  NEW.prev_hash  := v_prev;
  NEW.created_at := clock_timestamp();
  NEW.row_hash   := sha256(v_prev || convert_to(public.operation_log_canonical(NEW), 'UTF8'));
  RETURN NEW;
END $$;
CREATE TRIGGER operation_log_chain_bi BEFORE INSERT ON operation_log
  FOR EACH ROW EXECUTE FUNCTION operation_log_chain();

CREATE TRIGGER operation_log_no_edit     BEFORE UPDATE OR DELETE ON operation_log
  FOR EACH ROW       EXECUTE FUNCTION forbid_change();
CREATE TRIGGER operation_log_no_truncate BEFORE TRUNCATE ON operation_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

-- Recomputes the chain in one set-based pass (the UI's "Verify Hash Chain" button).
-- Returns the FIRST broken row. Detects edits, gaps and reordering, but not deletion of the
-- NEWEST rows (nothing later refers to them): export the head (seq, row_hash) outside the
-- database periodically and compare it. rows_checked = 0 means nothing was visible to the
-- caller (another tenant's id, or an empty log) - the API must not show that as "verified".
CREATE FUNCTION verify_operation_log(p_business uuid DEFAULT NULL)
RETURNS TABLE (ok boolean, rows_checked bigint, broken_seq bigint, reason text)
LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  WITH x AS (
    SELECT r.seq,
           row_number() OVER w AS rn,
           r.prev_hash,
           coalesce(lag(r.row_hash) OVER w, decode(repeat('00', 32), 'hex')) AS expected_prev,
           r.row_hash,
           sha256(r.prev_hash || convert_to(public.operation_log_canonical(r), 'UTF8')) AS recomputed
    FROM public.operation_log r
    WHERE r.scope = coalesce(p_business, '00000000-0000-0000-0000-000000000000'::uuid)
    WINDOW w AS (ORDER BY r.seq)),
  bad AS (
    SELECT seq, rn,
           CASE WHEN seq <> rn                THEN 'gap or reordering in sequence'
                WHEN prev_hash <> expected_prev THEN 'prev_hash does not match the previous row'
                ELSE 'row content does not match its hash' END AS reason
    FROM x WHERE seq <> rn OR prev_hash <> expected_prev OR row_hash <> recomputed
    ORDER BY rn LIMIT 1)
  SELECT (b.seq IS NULL),
         CASE WHEN b.seq IS NULL THEN (SELECT count(*) FROM x) ELSE b.rn - 1 END,
         b.seq, b.reason
  FROM (SELECT 1) one LEFT JOIN bad b ON true
$$;

-- ---------------------------------------------------------------------------------------
-- Views. security_invoker = the CALLER's row-level security applies (PG15+).
-- ---------------------------------------------------------------------------------------

-- The engine's input: every event for a deal with the day offset DERIVED from dates.
-- Baseline events (deal_id NULL) apply to every deal of the business. Two branches (UNION ALL)
-- so each uses its own index - an OR join would read every tenant's baseline rows.
-- The engine applies outflows before inflows on the same day:
--     ORDER BY day, apply_order, event_id
CREATE VIEW engine_input_events WITH (security_invoker = true) AS
SELECT d.id AS deal_id, e.id AS event_id, (e.event_date - d.start_date) AS day, e.event_date::date AS event_date,
       e.amount_minor, e.direction, e.kind, e.is_order_receipt, e.certainty, e.is_deferrable, e.incremental,
       e.invoice_ref, true AS is_baseline, CASE e.direction WHEN 'out' THEN 0 ELSE 1 END AS apply_order
FROM deal d
JOIN cash_event e ON e.business_id = d.business_id AND e.deal_id IS NULL
WHERE e.event_date >= d.start_date AND e.event_date - d.start_date <= 540
UNION ALL
SELECT d.id, e.id, (e.event_date - d.start_date), e.event_date::date,
       e.amount_minor, e.direction, e.kind, e.is_order_receipt, e.certainty, e.is_deferrable, e.incremental,
       e.invoice_ref, false, CASE e.direction WHEN 'out' THEN 0 ELSE 1 END
FROM deal d
JOIN cash_event e ON e.business_id = d.business_id AND e.deal_id = d.id
WHERE e.event_date >= d.start_date AND e.event_date - d.start_date <= 540;

-- What the engine window leaves out, so the API can warn (W-BASELINE-COVERAGE) instead of
-- silently ignoring obligations.
CREATE VIEW engine_input_coverage WITH (security_invoker = true) AS
SELECT d.id AS deal_id, d.business_id,
       (SELECT count(*) FROM cash_event e WHERE e.business_id = d.business_id AND (e.deal_id IS NULL OR e.deal_id = d.id)
          AND e.event_date < d.start_date)                          AS events_before_start,
       (SELECT count(*) FROM cash_event e WHERE e.business_id = d.business_id AND (e.deal_id IS NULL OR e.deal_id = d.id)
          AND e.event_date - d.start_date > 540)                    AS events_after_horizon,
       (SELECT max(e.event_date)::date FROM cash_event e WHERE e.business_id = d.business_id AND e.deal_id IS NULL) AS last_baseline_date
FROM deal d;

-- Trust derived from facts. "Recent" = the 3 newest settled invoices, so a good old record
-- cannot hide a recent slowdown.
CREATE VIEW customer_payment_stats WITH (security_invoker = true) AS
WITH settled AS (
  SELECT i.*, (paid_date - due_date) AS days_vs_due,
         row_number() OVER (PARTITION BY customer_id ORDER BY invoice_date DESC) AS recency
  FROM customer_invoice i
  WHERE paid_minor = amount_minor
)
SELECT c.business_id, c.id AS customer_id, c.name, c.red_flags,
       count(s.id)                                                   AS settled_invoices,
       count(s.id) FILTER (WHERE s.days_vs_due <= 0)                 AS paid_on_time,
       round(avg(greatest(s.days_vs_due, 0)), 1)                     AS avg_days_late,
       max(greatest(s.days_vs_due, 0))                               AS worst_days_late,
       round(avg(greatest(s.days_vs_due, 0)) FILTER (WHERE s.recency <= 3), 1) AS recent_avg_days_late,
       max(s.amount_minor)                                           AS largest_paid_minor,
       (SELECT count(*) FROM customer_invoice o
         WHERE o.customer_id = c.id AND o.paid_minor < o.amount_minor AND o.due_date < current_date) AS open_overdue
FROM customer c
LEFT JOIN settled s ON s.customer_id = c.id
GROUP BY c.business_id, c.id, c.name, c.red_flags;

-- One row per deal for the pipeline page: workflow state + live verdict + open flags, plus the
-- single status word the frontend shows (ui_status) and the money columns it displays.
CREATE VIEW deal_pipeline WITH (security_invoker = true) AS
SELECT d.id, d.business_id, d.public_ref, d.po_number, d.customer_id, c.name AS customer_name,
       d.status, d.currency, d.order_value_minor, d.delivery_date::date AS delivery_date, d.payment_days, d.payment_basis,
       d.negotiation_round, d.reserve_minor, d.opening_cash_minor,
       costs.incremental_costs_minor,
       d.order_value_minor - costs.incremental_costs_minor AS profit_before_financing_minor,
       ev.id AS evaluation_id, ev.verdict, ev.verdict_code, ev.recommended_option_key,
       ev.recommended_delay_tolerance_days, ev.lowest_balance_minor, ev.first_breach_date::date AS first_breach_date,
       flags.open_flags, flags.blocking_flags,
       CASE
         WHEN d.status = 'committed' THEN 'COMMITTED'
         WHEN d.status = 'closed'    THEN 'CLOSED'
         WHEN d.status = 'failed'    THEN 'FAILED'
         WHEN flags.blocking_flags > 0 OR ev.verdict = 'no_feasible_plan' THEN 'BLOCKED'
         WHEN d.status = 'ingesting'        THEN 'INGESTING'
         WHEN d.status = 'awaiting_confirm' THEN 'NEEDS_CONFIRMATION'
         WHEN d.status = 'awaiting_reply'   THEN 'AWAITING_REPLY'
         WHEN ev.verdict = 'feasible_as_offered' THEN 'FEASIBLE'
         WHEN ev.verdict = 'plan_recommended'    THEN 'RECOMMENDED'
         ELSE upper(d.status)
       END AS ui_status,
       d.created_at, d.updated_at
FROM deal d
LEFT JOIN customer   c  ON c.business_id = d.business_id AND c.id = d.customer_id
LEFT JOIN evaluation ev ON ev.business_id = d.business_id AND ev.deal_id = d.id AND ev.superseded_at IS NULL
CROSS JOIN LATERAL (
  SELECT coalesce(sum(e.amount_minor) FILTER (WHERE e.incremental AND e.direction = 'out'), 0)::bigint AS incremental_costs_minor
  FROM cash_event e WHERE e.deal_id = d.id) costs
CROSS JOIN LATERAL (
  SELECT count(*) AS open_flags, count(*) FILTER (WHERE f.blocking) AS blocking_flags
  FROM deal_flag f WHERE f.deal_id = d.id AND f.resolved_at IS NULL) flags;

-- Approval status (spec 04 10.2: valid / voided / used): voided when the evaluation it approved
-- was superseded (the UI's STALE banner), expired after expires_at, used once an execution
-- action covered by it has run.
CREATE VIEW approval_staleness WITH (security_invoker = true) AS
SELECT a.id AS approval_id, a.business_id, a.deal_id, a.action, a.decision, a.evaluation_id,
       (ev.superseded_at IS NOT NULL)                       AS is_stale,
       (a.expires_at IS NOT NULL AND a.expires_at <= now()) AS is_expired,
       EXISTS (SELECT 1 FROM execution_action x WHERE x.approval_id = a.id AND x.status IN ('sent','posted','accepted')) AS is_used,
       CASE
         WHEN a.decision = 'rejected' THEN 'rejected'
         WHEN EXISTS (SELECT 1 FROM execution_action x WHERE x.approval_id = a.id AND x.status IN ('sent','posted','accepted')) THEN 'used'
         WHEN ev.superseded_at IS NOT NULL THEN 'voided'
         WHEN a.expires_at IS NOT NULL AND a.expires_at <= now() THEN 'expired'
         ELSE 'valid'
       END AS approval_status
FROM approval a
LEFT JOIN evaluation ev ON ev.id = a.evaluation_id;
