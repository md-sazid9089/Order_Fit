-- OrderFit core schema.  PostgreSQL 15+ (tested on 16; Neon/PG17 compatible).
--
-- Conventions
--   * uuid primary keys (gen_random_uuid is built in since PG13)
--   * money = bigint minor units (cents / paisa) + a currency code. Never float.
--   * dates are the `biz_date` domain (finite, 2000-01-01 .. 2100-12-31); instants are timestamptz (UTC).
--     The engine's "day N" is DERIVED (event_date - deal.start_date), never stored.
--   * text + CHECK or a lookup table instead of native enums (adding a value is an INSERT,
--     not a migration).
--   * every tenant table carries business_id; child tables use COMPOSITE foreign keys
--     (business_id, [deal_id,] parent_id) so a row can never point at another tenant's - or
--     another deal's - parent.
--   * nothing is hard-deleted; financial records are archived or superseded.
--   * field names follow the engine contract in docs/architecture/orderfit/04 and fixtures/cases/*.json.

-- Finite business dates. Rejects 'infinity' (breaks date arithmetic in the engine view) and
-- typos such as year 0001 or 9999.
CREATE DOMAIN biz_date AS date CHECK (VALUE BETWEEN DATE '2000-01-01' AND DATE '2100-12-31');

-- ---------------------------------------------------------------------------------------
-- Reference data (rows are seeded in 0004)
-- ---------------------------------------------------------------------------------------
CREATE TABLE currency (
  code     char(3)  PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  exponent smallint NOT NULL CHECK (exponent BETWEEN 0 AND 4)   -- minor units per major = 10^exponent
);

CREATE TABLE app_role (
  code        text PRIMARY KEY,
  tier        text NOT NULL CHECK (tier IN ('T0','T1','T2','T3','T4')),
  description text NOT NULL
);

-- WORKFLOW state of a deal (where it is in the process). This is deliberately NOT the
-- engine verdict (see evaluation.verdict) and NOT a warning (see deal_flag). The frontend's
-- single "status" word is derived from all three in deal_pipeline.ui_status.
CREATE TABLE deal_status (
  code        text PRIMARY KEY,
  sort_order  smallint NOT NULL UNIQUE,
  is_terminal boolean  NOT NULL DEFAULT false,
  description text     NOT NULL
);

CREATE TABLE deal_transition (
  from_status text NOT NULL REFERENCES deal_status(code),
  to_status   text NOT NULL REFERENCES deal_status(code),
  PRIMARY KEY (from_status, to_status),
  CHECK (from_status <> to_status)
);

-- Cash event kinds: the union of the engine contract (04 section 10.2), the fixtures and the UI.
CREATE TABLE cash_event_kind (
  code             text PRIMARY KEY CHECK (code ~ '^[a-z_]+$'),
  is_order_receipt boolean NOT NULL DEFAULT false,   -- shifted by the customer-delay scenario
  description      text NOT NULL
);

-- ---------------------------------------------------------------------------------------
-- Tenants and users
-- ---------------------------------------------------------------------------------------
CREATE TABLE business (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL CHECK (btrim(name) <> ''),
  currency     char(3) NOT NULL REFERENCES currency(code),
  timezone     text NOT NULL DEFAULT 'UTC' CHECK (timezone ~ '^[A-Za-z0-9_+/-]{1,64}$'),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','suspended')),
  is_synthetic boolean NOT NULL DEFAULT false,
  -- settings-page fields that are not queried on (trade registration, tax id, phone, address,
  -- session timeout, notification defaults ...). jsonb instead of ten sparse columns.
  profile      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(profile) = 'object'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, currency)                              -- target of deal (business_id, currency)
);

CREATE TABLE app_user (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1 AND length(email) <= 254),
  full_name         text NOT NULL CHECK (btrim(full_name) <> ''),
  password_hash     text,                         -- argon2/bcrypt hash only; NULL if an external IdP is used. Readable only via auth_lookup()
  auth_subject      text UNIQUE,                  -- external IdP subject, if any
  is_platform_admin boolean NOT NULL DEFAULT false,   -- cross-tenant console; the app role cannot set it (0003)
  mfa_enforced      boolean NOT NULL DEFAULT true,
  status            text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended')),
  preferences       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences) = 'object'), -- timezone, language, notify_*
  last_active_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- A user may belong to several businesses, with one role in each.
CREATE TABLE membership (
  user_id     uuid NOT NULL REFERENCES app_user(id),
  business_id uuid NOT NULL REFERENCES business(id),
  role        text NOT NULL REFERENCES app_role(code),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);
CREATE INDEX membership_business_idx ON membership (business_id);

-- ---------------------------------------------------------------------------------------
-- Counterparties
-- ---------------------------------------------------------------------------------------
CREATE TABLE customer (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES business(id),
  name          text NOT NULL CHECK (btrim(name) <> ''),
  known_domains text[] NOT NULL DEFAULT '{}',
  red_flags     text[] NOT NULL DEFAULT '{}',     -- e.g. 'bankrupt'. A current red flag overrides good history.
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id)
);
CREATE UNIQUE INDEX customer_name_uq ON customer (business_id, lower(name)) WHERE archived_at IS NULL;

-- Payment HISTORY (facts). Trust is DERIVED from this in the customer_payment_stats view
-- instead of being a stored label that goes stale.
CREATE TABLE customer_invoice (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL,
  customer_id  uuid NOT NULL,
  invoice_ref  text NOT NULL CHECK (btrim(invoice_ref) <> '' AND length(invoice_ref) <= 100),
  invoice_date biz_date NOT NULL,
  due_date     biz_date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  paid_minor   bigint NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  paid_date    biz_date,                           -- date of the last payment
  CHECK (due_date >= invoice_date),
  CHECK (paid_minor <= amount_minor),
  CHECK ((paid_minor = 0) = (paid_date IS NULL)),
  UNIQUE (business_id, customer_id, invoice_ref),
  FOREIGN KEY (business_id, customer_id) REFERENCES customer (business_id, id)
);
CREATE INDEX customer_invoice_customer_idx ON customer_invoice (customer_id, invoice_date DESC);

CREATE TABLE payee (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          uuid NOT NULL REFERENCES business(id),
  name                 text NOT NULL CHECK (btrim(name) <> ''),
  kind                 text NOT NULL DEFAULT 'supplier' CHECK (kind IN ('supplier','customer','lender')),   -- spec 04 10.2
  category             text NOT NULL CHECK (category IN ('raw_material','packaging','freight_customs','subcontract','labour','finance','other')),
  terms_days           integer CHECK (terms_days BETWEEN 0 AND 365),
  terms_note           text,
  delay_tolerance_note text,                       -- UI "historical delay tolerance" (free text, not an engine input)
  risk_rating          text CHECK (risk_rating IN ('low','medium','high')),
  known_domains        text[] NOT NULL DEFAULT '{}',
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id)
);
CREATE UNIQUE INDEX payee_name_uq ON payee (business_id, lower(name)) WHERE archived_at IS NULL;

-- Raw account numbers are NEVER stored. fingerprint = HMAC-SHA256(server_secret, account_no)
-- computed by the API (plain SHA-256 of a short number is brute-forceable).
-- A payment to an account not listed here as 'verified' raises SEC-FRAUD.
CREATE TABLE payee_bank_account (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL,
  payee_id            uuid NOT NULL,
  bank_name           text,
  account_fingerprint bytea NOT NULL CHECK (octet_length(account_fingerprint) = 32),
  last4               text NOT NULL CHECK (last4 ~ '^[0-9A-Za-z]{4}$'),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
  verified_by         uuid REFERENCES app_user(id),
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  UNIQUE (payee_id, account_fingerprint),
  FOREIGN KEY (business_id, payee_id) REFERENCES payee (business_id, id)
);
CREATE INDEX payee_bank_account_payee_idx ON payee_bank_account (business_id, payee_id);

-- ---------------------------------------------------------------------------------------
-- Owner constraints: VERSIONED and immutable. A settings "save" inserts a new version.
-- Each deal pins the version it was evaluated under, so past results stay reproducible.
-- Column names follow fixtures/cases/*.json "owner", "scenarios" and "strategy_space".
-- ---------------------------------------------------------------------------------------
CREATE TABLE owner_constraints (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                    uuid NOT NULL REFERENCES business(id),
  version                        integer NOT NULL CHECK (version >= 1),
  safety_reserve_minor           bigint  NOT NULL CHECK (safety_reserve_minor >= 0),
  min_delay_tolerance_days       integer NOT NULL DEFAULT 15 CHECK (min_delay_tolerance_days BETWEEN 0 AND 365),
  max_customer_concentration_bps integer CHECK (max_customer_concentration_bps BETWEEN 0 AND 10000),
  min_order_profit_minor         bigint  NOT NULL DEFAULT 0 CHECK (min_order_profit_minor >= 0),
  max_financing_cost_minor       bigint  CHECK (max_financing_cost_minor >= 0),           -- fixtures owner.max_financing_cost (NULL = no cap)
  max_financing_cost_bps         integer CHECK (max_financing_cost_bps BETWEEN 0 AND 10000), -- UI "max cost 3.5%"
  target_scenario                text    NOT NULL DEFAULT 'base' CHECK (target_scenario IN ('base','downside','severe')),
  priorities                     text[]  NOT NULL DEFAULT ARRAY['profit','independence_customer','simplicity']
                                   CHECK (priorities <@ ARRAY['profit','independence_customer','independence_any','simplicity']
                                          AND cardinality(priorities) BETWEEN 1 AND 4),
  close_call_bps                 integer NOT NULL DEFAULT 200 CHECK (close_call_bps BETWEEN 0 AND 10000),
  -- deposit concession (the customer asks a discount for paying early); engine 04 section 4
  deposit_discount_bps           integer NOT NULL DEFAULT 0 CHECK (deposit_discount_bps >= 0),
  deposit_discount_bps_per_10pct integer NOT NULL DEFAULT 0 CHECK (deposit_discount_bps_per_10pct >= 0),
  max_deposit_concession_bps     integer CHECK (max_deposit_concession_bps BETWEEN 0 AND 10000),
  deposit_lead_days              integer NOT NULL DEFAULT 7 CHECK (deposit_lead_days BETWEEN 0 AND 365),
  -- stress scenarios (both always present; defaults are the anchor case's)
  downside_order_delay_days      integer NOT NULL DEFAULT 15  CHECK (downside_order_delay_days BETWEEN 0 AND 365),
  downside_ar_delay_days         integer NOT NULL DEFAULT 5   CHECK (downside_ar_delay_days BETWEEN 0 AND 365),
  downside_cost_overrun_bps      integer NOT NULL DEFAULT 0   CHECK (downside_cost_overrun_bps BETWEEN 0 AND 10000),
  downside_deposit_follows_delay boolean NOT NULL DEFAULT true,
  severe_order_delay_days        integer NOT NULL DEFAULT 45  CHECK (severe_order_delay_days BETWEEN 0 AND 365),
  severe_ar_delay_days           integer NOT NULL DEFAULT 15  CHECK (severe_ar_delay_days BETWEEN 0 AND 365),
  severe_cost_overrun_bps        integer NOT NULL DEFAULT 300 CHECK (severe_cost_overrun_bps BETWEEN 0 AND 10000),
  severe_deposit_follows_delay   boolean NOT NULL DEFAULT true,
  max_supplier_extension_days    integer CHECK (max_supplier_extension_days BETWEEN 0 AND 365),
  max_delay_scan_days            integer NOT NULL DEFAULT 180 CHECK (max_delay_scan_days BETWEEN 1 AND 540),
  max_negotiation_rounds         smallint NOT NULL DEFAULT 3 CHECK (max_negotiation_rounds BETWEEN 1 AND 3),
  -- enumerated strategy grid: {"deposit_pcts":[..], "extensions":[{"days":..,"surcharge_bps":..}], "offer_ids":[..], "stages":[..], "stage_gap_days":..}
  strategy_space                 jsonb   NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(strategy_space) = 'object'),
  created_by                     uuid NOT NULL REFERENCES app_user(id),
  created_at                     timestamptz NOT NULL DEFAULT now(),
  CHECK (downside_order_delay_days <= severe_order_delay_days),
  UNIQUE (business_id, version),
  UNIQUE (business_id, id)
);

-- Engine's financing offer + the UI's "facility" card in one table. Terms follow the reference
-- engine: interest_bps is charged ONCE on the principal for the whole term (not per month).
-- The AI may never invent terms: the terms guard checks proposals against rows here.
CREATE TABLE financing_offer (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL REFERENCES business(id),
  name               text NOT NULL CHECK (btrim(name) <> ''),
  kind               text NOT NULL CHECK (kind IN ('revolving_overdraft','receivable_factoring','po_financing','term_loan')),
  interest_bps       integer NOT NULL DEFAULT 0 CHECK (interest_bps BETWEEN 0 AND 10000),
  fee_bps            integer NOT NULL DEFAULT 0 CHECK (fee_bps BETWEEN 0 AND 10000),
  fee_flat_minor     bigint  NOT NULL DEFAULT 0 CHECK (fee_flat_minor >= 0),
  fee_at             text    NOT NULL DEFAULT 'draw' CHECK (fee_at IN ('draw','repayment')),
  lead_days          integer NOT NULL DEFAULT 0 CHECK (lead_days BETWEEN 0 AND 365),
  min_minor          bigint  NOT NULL DEFAULT 0 CHECK (min_minor >= 0),
  max_minor          bigint  NOT NULL CHECK (max_minor > 0),
  step_minor         bigint  NOT NULL DEFAULT 1 CHECK (step_minor > 0),
  term_days          integer NOT NULL CHECK (term_days BETWEEN 1 AND 540),       -- the engine horizon is 540 days
  available_from     biz_date,
  valid_until        biz_date,
  limit_minor        bigint  CHECK (limit_minor > 0),
  drawn_minor        bigint  NOT NULL DEFAULT 0 CHECK (drawn_minor >= 0),
  available_minor    bigint  GENERATED ALWAYS AS (limit_minor - drawn_minor) STORED,
  interest_method    text,                                                        -- UI description only
  status             text    NOT NULL DEFAULT 'active' CHECK (status IN ('active','pre_approved','closed')),
  source             text    NOT NULL DEFAULT 'owner_entered' CHECK (source IN ('catalogue','owner_entered')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (min_minor <= max_minor),
  CHECK (limit_minor IS NULL OR drawn_minor <= limit_minor),
  CHECK (valid_until IS NULL OR available_from IS NULL OR valid_until >= available_from),
  UNIQUE (business_id, id)
);

-- ---------------------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------------------
CREATE TABLE deal (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES business(id),
  public_ref          text NOT NULL CHECK (btrim(public_ref) <> '' AND length(public_ref) <= 64),   -- the human id: 'OF-02'
  po_number           text,                                               -- 'PO-8841'
  customer_id         uuid,
  status              text NOT NULL DEFAULT 'ingesting' REFERENCES deal_status(code),
  currency            char(3) NOT NULL,                                   -- = business currency (FK below); filled if omitted
  start_date          biz_date NOT NULL DEFAULT current_date,             -- engine day 0 ("as_of")
  -- SNAPSHOT of the inputs that existed when the deal was analysed. Never read these live
  -- from the business: re-running a deal next week must give the same answer.
  opening_cash_minor  bigint,                                             -- may be negative (overdraft)
  reserve_minor       bigint NOT NULL CHECK (reserve_minor >= 0),         -- defaults from constraints; override is logged
  constraints_id      uuid NOT NULL,
  target_scenario     text CHECK (target_scenario IN ('base','downside','severe')),   -- NULL = use the constraints version
  -- confirmed order terms (filled at checkpoint 1)
  order_value_minor      bigint CHECK (order_value_minor > 0),
  order_date             biz_date,                                        -- anchor 'order'
  invoice_date           biz_date,                                        -- anchor 'invoice'
  delivery_date          biz_date,                                        -- anchor 'delivery'
  payment_days           smallint CHECK (payment_days BETWEEN 0 AND 365),
  payment_basis          text CHECK (payment_basis IN ('invoice','delivery','order')),   -- NULL = ambiguous: the owner must choose
  deposit_discount_bps           integer CHECK (deposit_discount_bps >= 0),              -- snapshot; defaulted from constraints
  deposit_discount_bps_per_10pct integer CHECK (deposit_discount_bps_per_10pct >= 0),
  cancellation_clause    text,
  late_penalty_bps_per_day integer CHECK (late_penalty_bps_per_day >= 0),
  negotiation_round   smallint NOT NULL DEFAULT 0 CHECK (negotiation_round BETWEEN 0 AND 3),
  version             integer NOT NULL DEFAULT 1,                         -- optimistic locking, bumped by trigger
  created_by          uuid NOT NULL REFERENCES app_user(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  UNIQUE (business_id, id),
  UNIQUE (business_id, public_ref),
  FOREIGN KEY (business_id, currency)       REFERENCES business (id, currency),
  FOREIGN KEY (business_id, customer_id)    REFERENCES customer (business_id, id),
  FOREIGN KEY (business_id, constraints_id) REFERENCES owner_constraints (business_id, id),
  CONSTRAINT deal_delivery_after_start CHECK (delivery_date IS NULL OR delivery_date >= start_date),
  -- Once a deal moves past confirmation, every term the engine needs must be present,
  -- including the anchor date the payment basis refers to. This is what makes an
  -- ambiguous "Net 30" (no anchor) impossible to compute on.
  CONSTRAINT deal_terms_present_after_confirm CHECK (
    status IN ('ingesting','awaiting_confirm','failed','closed')
    OR (customer_id IS NOT NULL AND opening_cash_minor IS NOT NULL AND order_value_minor IS NOT NULL
        AND delivery_date IS NOT NULL AND payment_days IS NOT NULL AND payment_basis IS NOT NULL
        AND (payment_basis <> 'invoice' OR invoice_date IS NOT NULL)
        AND (payment_basis <> 'order'   OR order_date   IS NOT NULL))
  ),
  CONSTRAINT deal_closed_at_matches_status CHECK ((closed_at IS NOT NULL) = (status IN ('committed','closed')))
);
CREATE INDEX deal_pipeline_idx  ON deal (business_id, status, created_at DESC);
CREATE INDEX deal_recent_idx    ON deal (business_id, created_at DESC);
CREATE INDEX deal_customer_idx  ON deal (business_id, customer_id);

-- ---------------------------------------------------------------------------------------
-- Documents and what was read from them
-- ---------------------------------------------------------------------------------------
CREATE TABLE document (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL,
  deal_id           uuid NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('po','quote','cash','bills','financing','constraints','reply','csv','other')),
  content_hash      bytea NOT NULL CHECK (octet_length(content_hash) = 32),    -- SHA-256 of the bytes; detects duplicates
  storage_key       text NOT NULL CHECK (length(storage_key) <= 512),
  original_filename text NOT NULL CHECK (length(original_filename) <= 255),
  mime_type         text NOT NULL CHECK (mime_type IN (
                      'application/pdf','text/plain','text/csv','application/json',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  size_bytes        bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),  -- 25 MB
  untrusted         boolean NOT NULL DEFAULT true,                              -- content is data, never instructions
  uploaded_by       uuid NOT NULL REFERENCES app_user(id),
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id),
  UNIQUE (business_id, deal_id, id),
  UNIQUE (deal_id, content_hash),              -- same file twice in one deal: the dedupe prompt (case D-09)
  FOREIGN KEY (business_id, deal_id) REFERENCES deal (business_id, id)
);
-- storage is content-addressed per business (documents/<business_id>/<sha256>): lookup for reuse
CREATE INDEX document_business_hash_idx ON document (business_id, content_hash);

-- Raw AI output, kept APART from the confirmed values. Confirmation copies from here and
-- records who confirmed, so a wrong figure can be traced to the step where it entered.
CREATE TABLE extracted_field (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id     uuid NOT NULL,
  deal_id         uuid NOT NULL,
  document_id     uuid NOT NULL,
  field           text NOT NULL CHECK (field ~ '^[a-z][a-z0-9_.]{0,63}$'),   -- 'order_value_minor', 'acceptance.customer' ...
  value           jsonb NOT NULL,                     -- JSON null only when status = 'missing'
  source_page     integer CHECK (source_page >= 1),
  source_quote    text,                               -- the exact text; the UI's "[PO-8841 p.1]" citation
  confidence      numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  -- spec 04 10.2 statuses (extracted, ambiguous, missing, conflicting) + the owner's decision
  status          text NOT NULL DEFAULT 'extracted' CHECK (status IN ('extracted','ambiguous','missing','conflicting','confirmed','overridden','rejected')),
  confirmed_value jsonb,
  confirmed_by    uuid REFERENCES app_user(id),
  confirmed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, document_id, field),
  FOREIGN KEY (business_id, deal_id)              REFERENCES deal (business_id, id),
  FOREIGN KEY (business_id, deal_id, document_id) REFERENCES document (business_id, deal_id, id),   -- same deal
  CONSTRAINT extracted_value_meaningful CHECK (
    value <> '""'::jsonb AND (value <> 'null'::jsonb OR status = 'missing')
  ),
  CONSTRAINT extracted_confirmation_complete CHECK (
    (status IN ('extracted','ambiguous','missing','conflicting','rejected') AND confirmed_by IS NULL AND confirmed_at IS NULL)
    OR (status IN ('confirmed','overridden') AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL
        AND confirmed_value IS NOT NULL AND confirmed_value NOT IN ('""'::jsonb, 'null'::jsonb))
  )
);

-- ---------------------------------------------------------------------------------------
-- Cash events. deal_id NULL = baseline obligations of the business (payroll, rent, receivables).
-- deal_id set = events caused by that deal (supplier deposit, order receipt ...).
-- Amount is always positive; `direction` carries the sign (prevents a class of sign bugs).
-- Events are stored in the BUSINESS currency (deal.currency is forced equal to it).
-- ---------------------------------------------------------------------------------------
CREATE TABLE cash_event (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id        uuid NOT NULL,
  deal_id            uuid,
  event_date         biz_date NOT NULL,
  amount_minor       bigint NOT NULL CHECK (amount_minor > 0),
  direction          text NOT NULL CHECK (direction IN ('in','out')),
  kind               text NOT NULL REFERENCES cash_event_kind(code),
  certainty          text NOT NULL DEFAULT 'expected' CHECK (certainty IN ('confirmed','expected','assumed')),
  description        text CHECK (length(description) <= 500),
  invoice_ref        text CHECK (length(invoice_ref) <= 100),        -- powers the duplicate-invoice check
  is_deferrable      boolean NOT NULL DEFAULT false,
  incremental        boolean NOT NULL DEFAULT false,      -- cost caused by taking this order
  is_order_receipt   boolean GENERATED ALWAYS AS (kind IN ('order_receipt','order_final_receipt','order_stage_receipt')) STORED,
  customer_id        uuid,
  payee_id           uuid,
  source_document_id uuid,
  source_quote       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (kind NOT IN ('order_receipt','order_final_receipt','order_stage_receipt','order_deposit')
         OR (direction = 'in' AND deal_id IS NOT NULL)),
  CHECK (NOT incremental OR deal_id IS NOT NULL),
  FOREIGN KEY (business_id, deal_id)            REFERENCES deal (business_id, id),
  FOREIGN KEY (business_id, customer_id)        REFERENCES customer (business_id, id),
  FOREIGN KEY (business_id, payee_id)           REFERENCES payee (business_id, id),
  FOREIGN KEY (business_id, source_document_id) REFERENCES document (business_id, id)
);
CREATE INDEX cash_event_deal_idx     ON cash_event (deal_id, event_date);
CREATE INDEX cash_event_baseline_idx ON cash_event (business_id, event_date) WHERE deal_id IS NULL;

-- ---------------------------------------------------------------------------------------
-- Engine results. IMMUTABLE (only superseded_at may change). Stores the full input snapshot,
-- its hash and the engine version so any result can be re-run and compared after a bug fix.
-- ---------------------------------------------------------------------------------------
CREATE TABLE evaluation (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                    uuid NOT NULL,
  deal_id                        uuid NOT NULL,
  round                          smallint NOT NULL CHECK (round BETWEEN 0 AND 3),   -- = deal.negotiation_round (trigger)
  engine_version                 text NOT NULL CHECK (engine_version ~ '^[A-Za-z0-9._+-]{1,40}$'),
  input_hash                     bytea NOT NULL CHECK (octet_length(input_hash) = 32),
  inputs                         jsonb NOT NULL,
  output                         jsonb NOT NULL,           -- timelines, stress table, sensitivity, assumptions (bulky; not queried on)
  -- verdict is the ENGINE's answer. Workflow state lives on deal.status; warnings live in deal_flag.
  verdict                        text NOT NULL CHECK (verdict IN ('feasible_as_offered','plan_recommended','no_feasible_plan')),
  verdict_code                   text CHECK (verdict_code ~ '^[A-Z][A-Z0-9-]{1,40}$'),   -- 'E-NO-FEASIBLE', 'E-FRAGILE-BEST' ...
  first_breach_date              biz_date,
  lowest_balance_minor           bigint NOT NULL,
  recommended_option_key         text,
  -- NULL means "safe even with no payment". Negative means "fails even if paid on time".
  -- Only meaningful when recommended_option_key is set.
  recommended_delay_tolerance_days integer,
  superseded_at                  timestamptz,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id),
  UNIQUE (business_id, deal_id, id),
  FOREIGN KEY (business_id, deal_id) REFERENCES deal (business_id, id),
  CHECK (verdict <> 'no_feasible_plan'  OR recommended_option_key IS NULL),
  CHECK (verdict <> 'plan_recommended'  OR recommended_option_key IS NOT NULL),
  CHECK (recommended_option_key IS NOT NULL OR recommended_delay_tolerance_days IS NULL)
);
-- exactly one live evaluation per deal; a newer one supersedes the old (the UI's STALE banner).
-- Re-running identical inputs: look the live row up by (deal_id, input_hash) and reuse it.
CREATE UNIQUE INDEX evaluation_one_live_per_deal ON evaluation (deal_id) WHERE superseded_at IS NULL;
CREATE INDEX evaluation_live_business_idx ON evaluation (business_id, deal_id) WHERE superseded_at IS NULL;
CREATE INDEX evaluation_input_idx ON evaluation (deal_id, input_hash);

CREATE TABLE evaluation_option (
  business_id          uuid NOT NULL,
  evaluation_id        uuid NOT NULL,
  option_key           text NOT NULL CHECK (btrim(option_key) <> '' AND length(option_key) <= 80),  -- 'dep40', 'fin:BANK_WC@130000000' ...
  rank                 smallint CHECK (rank >= 1),        -- NULL = not eligible
  levers               jsonb NOT NULL,
  delay_tolerance_days integer,                           -- NULL = safe even with no payment; -1 = fails on time
  cost_minor           bigint NOT NULL CHECK (cost_minor >= 0),
  borrowed_minor       bigint NOT NULL DEFAULT 0 CHECK (borrowed_minor >= 0),
  lowest_balance_minor bigint NOT NULL,
  meets_target         boolean NOT NULL,
  PRIMARY KEY (evaluation_id, option_key),
  UNIQUE (business_id, evaluation_id, option_key),
  UNIQUE (evaluation_id, rank),
  FOREIGN KEY (business_id, evaluation_id) REFERENCES evaluation (business_id, id)
);
ALTER TABLE evaluation
  ADD CONSTRAINT evaluation_recommended_option_fk
  FOREIGN KEY (id, recommended_option_key) REFERENCES evaluation_option (evaluation_id, option_key)
  DEFERRABLE INITIALLY DEFERRED;     -- the evaluation row is inserted before its option rows

-- Warnings raised by validation, guards and the owner. A BLOCKING unresolved flag stops the
-- deal advancing (trigger in 0002).
CREATE TABLE deal_flag (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id     uuid NOT NULL,
  deal_id         uuid NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('ambiguity','injection','fraud','validation','override','data_conflict')),
  code            text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9-]{1,40}$'),     -- E-MISSING-ANCHOR, F-01, SEC-FRAUD ...
  message         text NOT NULL CHECK (length(message) <= 2000),
  field           text,
  blocking        boolean NOT NULL,
  raised_by       text NOT NULL CHECK (raised_by IN ('owner','agent','engine','system')),
  raised_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES app_user(id),
  resolution_note text,
  CHECK ((resolved_at IS NULL) = (resolved_by IS NULL)),
  FOREIGN KEY (business_id, deal_id) REFERENCES deal (business_id, id)
);
CREATE INDEX deal_flag_open_idx ON deal_flag (deal_id) WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------------------------
-- Messages and approvals
-- ---------------------------------------------------------------------------------------
CREATE TABLE negotiation_message (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL,
  deal_id            uuid NOT NULL,
  round              smallint NOT NULL CHECK (round BETWEEN 0 AND 3),
  direction          text NOT NULL CHECK (direction IN ('outbound','inbound')),
  counterparty_kind  text NOT NULL CHECK (counterparty_kind IN ('customer','supplier','lender')),
  channel            text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','whatsapp','sms','portal','other')),
  subject            text CHECK (length(subject) <= 500),
  body               text NOT NULL CHECK (length(body) BETWEEN 1 AND 100000),
  body_sha256        bytea NOT NULL,                         -- ALWAYS recomputed from body by trigger (0002)
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','sent','received','discarded')),
  extracted_terms    jsonb,                                  -- terms parsed from an inbound reply (data, never instructions)
  source_document_id uuid,
  created_by         uuid REFERENCES app_user(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  sent_at            timestamptz,
  UNIQUE (business_id, id),
  UNIQUE (business_id, deal_id, id, body_sha256),            -- what an approval pins
  FOREIGN KEY (business_id, deal_id)            REFERENCES deal (business_id, id),
  FOREIGN KEY (business_id, source_document_id) REFERENCES document (business_id, id),
  CHECK ((direction = 'inbound'  AND status = 'received')
      OR (direction = 'outbound' AND status IN ('draft','approved','sent','discarded'))),
  CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);
CREATE INDEX negotiation_message_deal_idx ON negotiation_message (deal_id, round);

-- Append-only. The approval pins the evaluation and option OF THE SAME DEAL, and for an
-- outbound send the message body by hash, through composite foreign keys: editing an
-- approved draft changes its hash, so the database itself refuses the edit.
CREATE TABLE approval (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL,
  deal_id             uuid NOT NULL,
  action              text NOT NULL CHECK (action IN ('confirm_figures','send_message','commit_plan','compensate','override')),
  evaluation_id       uuid,
  option_key          text,
  message_id          uuid,
  message_sha256      bytea,
  action_plan_hash    bytea CHECK (octet_length(action_plan_hash) = 32),   -- the 64-hex "ACTION_PLAN_HASH" the UI shows
  approver_id         uuid NOT NULL,
  decision            text NOT NULL CHECK (decision IN ('approved','edited','rejected')),
  edited_text         text,
  step_up_verified_at timestamptz,                        -- when the step-up check passed; the code itself is never stored
  idempotency_key     text NOT NULL CHECK (btrim(idempotency_key) <> '' AND length(idempotency_key) <= 200),
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key),                  -- a retry can never act twice
  UNIQUE (business_id, deal_id, id),
  FOREIGN KEY (business_id, deal_id)                             REFERENCES deal (business_id, id),
  FOREIGN KEY (approver_id, business_id)                         REFERENCES membership (user_id, business_id),
  FOREIGN KEY (business_id, deal_id, evaluation_id)              REFERENCES evaluation (business_id, deal_id, id),
  FOREIGN KEY (business_id, evaluation_id, option_key)           REFERENCES evaluation_option (business_id, evaluation_id, option_key),
  FOREIGN KEY (business_id, deal_id, message_id, message_sha256) REFERENCES negotiation_message (business_id, deal_id, id, body_sha256),
  CHECK ((decision = 'edited') = (edited_text IS NOT NULL)),
  CHECK (action NOT IN ('send_message','commit_plan') OR (evaluation_id IS NOT NULL AND option_key IS NOT NULL AND action_plan_hash IS NOT NULL)),
  CHECK (action <> 'compensate' OR action_plan_hash IS NOT NULL),
  CHECK (action <> 'send_message' OR (message_id IS NOT NULL AND message_sha256 IS NOT NULL)),
  -- outgoing actions need the step-up (spec 03 section 8); rejections do not
  CHECK (action NOT IN ('send_message','commit_plan','compensate') OR decision = 'rejected' OR step_up_verified_at IS NOT NULL),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE INDEX approval_deal_idx ON approval (deal_id, created_at);
CREATE INDEX approval_evaluation_idx ON approval (evaluation_id) WHERE evaluation_id IS NOT NULL;

-- The simulated bank, outbox and lender portal (spec 04 10.2 "sandbox_action"): what the
-- system actually executes after an approval. The payload is immutable once drafted;
-- anything past 'drafted' needs a valid approval whose plan hash matches (trigger in 0002).
CREATE TABLE execution_action (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL,
  deal_id         uuid NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('ledger_entry','message','lender_acceptance','cancellation')),
  payee_id        uuid,
  message_id      uuid,
  amount_minor    bigint CHECK (amount_minor > 0),
  scheduled_date  biz_date,
  payload         jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  plan_hash       bytea NOT NULL CHECK (octet_length(plan_hash) = 32),
  approval_id     uuid,
  status          text NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted','scheduled','sent','posted','accepted','cancelled','voided','failed')),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND length(idempotency_key) <= 200),
  failure_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  executed_at     timestamptz,
  UNIQUE (business_id, idempotency_key),
  FOREIGN KEY (business_id, deal_id)              REFERENCES deal (business_id, id),
  FOREIGN KEY (business_id, deal_id, approval_id) REFERENCES approval (business_id, deal_id, id),
  FOREIGN KEY (business_id, payee_id)             REFERENCES payee (business_id, id),
  FOREIGN KEY (business_id, message_id)           REFERENCES negotiation_message (business_id, id),
  CHECK (kind <> 'ledger_entry' OR (payee_id IS NOT NULL AND amount_minor IS NOT NULL AND scheduled_date IS NOT NULL)),
  CHECK (kind <> 'message' OR message_id IS NOT NULL),
  CHECK (status IN ('drafted','voided') OR approval_id IS NOT NULL),
  CHECK ((status IN ('sent','posted','accepted')) = (executed_at IS NOT NULL))
);
CREATE INDEX execution_action_deal_idx ON execution_action (deal_id, created_at);

-- What-if runs from the sandbox page (sliders: deposit, delay, overdraft). Not financial records.
CREATE TABLE whatif_run (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  deal_id     uuid,
  user_id     uuid NOT NULL REFERENCES app_user(id),
  params      jsonb NOT NULL,
  result      jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, deal_id) REFERENCES deal (business_id, id)
);
CREATE INDEX whatif_run_deal_idx ON whatif_run (business_id, deal_id);

-- In-app notifications (the bell). user_id NULL = every member of the business.
CREATE TABLE notification (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id  uuid NOT NULL REFERENCES business(id),
  user_id      uuid,
  deal_id      uuid,
  severity     text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  code         text,
  title        text NOT NULL CHECK (btrim(title) <> '' AND length(title) <= 200),
  message      text NOT NULL CHECK (length(message) <= 2000),
  action_url   text CHECK (action_url ~ '^/[A-Za-z0-9/_?=&.-]*$'),     -- in-app route only, never an external URL
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, business_id) REFERENCES membership (user_id, business_id),
  FOREIGN KEY (business_id, deal_id) REFERENCES deal (business_id, id)
);
CREATE INDEX notification_inbox_idx ON notification (business_id, user_id, created_at DESC);

CREATE TABLE idempotency_key (
  business_id  uuid NOT NULL REFERENCES business(id),
  key          text NOT NULL CHECK (btrim(key) <> '' AND length(key) <= 200),
  scope        text NOT NULL CHECK (length(scope) <= 200),
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  status       text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (business_id, key)
);
