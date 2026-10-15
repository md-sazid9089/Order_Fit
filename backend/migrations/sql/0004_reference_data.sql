-- Reference data. Changing these is a migration, not an application action.

INSERT INTO currency (code, exponent) VALUES
  ('USD', 2), ('BDT', 2), ('EUR', 2), ('GBP', 2);

-- Tier mapping comes from the frontend users page (superadmin T4, risk_officer T3,
-- commercial_lead T2, auditor T0) and the spec roles (owner, viewer). Approval rules in 0002:
-- confirm_figures needs T2+, send_message / commit_plan / compensate / override need T3+.
INSERT INTO app_role (code, tier, description) VALUES
  ('viewer',          'T0', 'Read-only'),
  ('auditor',         'T0', 'Read-only, audit log and exports'),
  ('commercial_lead', 'T2', 'Prepares orders, confirms figures and drafts; cannot approve sends'),
  ('risk_officer',    'T3', 'Approves plans and sends'),
  ('owner',           'T3', 'Business owner; approves plans and sends'),
  ('superadmin',      'T4', 'Platform administrator (assigned by the platform, never by the application)');

-- Cash event kinds: spec 04 section 10.2 (16 kinds) + fixtures + UI.
INSERT INTO cash_event_kind (code, is_order_receipt, description) VALUES
  ('payroll',             false, 'Staff salaries'),
  ('rent',                false, 'Rent'),
  ('tax',                 false, 'Tax payment'),
  ('ap_payment',          false, 'Existing accounts-payable payment'),
  ('ar_collection',       false, 'Existing receivable collected from another customer (shifted by the AR-delay scenario)'),
  ('loan_installment',    false, 'Installment on an existing loan'),
  ('supplier_payment',    false, 'Supplier payment for this order'),
  ('labour',              false, 'Labour for this order'),
  ('freight',             false, 'Freight / logistics for this order'),
  ('subcontract',         false, 'Subcontracted work for this order'),
  ('existing_inventory',  false, 'Stock already owned that the order consumes (usually non-incremental)'),
  ('order_deposit',       false, 'Customer deposit / advance for this order'),
  ('order_receipt',       true,  'Customer payment for this order'),
  ('order_final_receipt', true,  'Final customer payment for this order (shifted by the customer-delay scenario)'),
  ('order_stage_receipt', true,  'Staged customer payment for this order'),
  ('loan_draw',           false, 'New financing drawn'),
  ('loan_fee',            false, 'Financing fee'),
  ('loan_interest',       false, 'Financing interest'),
  ('loan_repayment',      false, 'Financing repayment'),
  ('other',               false, 'Anything else');

-- Workflow states. The 7 states of backend/orderfit/domain.py plus 'committed'.
-- The 15-state machine of docs/architecture/orderfit/03 section 4.1 can be adopted by adding
-- rows here and edges below; no schema change is needed. The frontend's single status word is
-- deal_pipeline.ui_status (workflow state + engine verdict + blocking flags).
INSERT INTO deal_status (code, sort_order, is_terminal, description) VALUES
  ('ingesting',         1, false, 'Documents uploaded; extraction and validation running'),
  ('awaiting_confirm',  2, false, 'Checkpoint 1: owner confirms extracted figures and resolves ambiguity'),
  ('computing',         3, false, 'Engine running'),
  ('awaiting_approval', 4, false, 'Checkpoint 2: owner approves the plan / outgoing message'),
  ('awaiting_reply',    5, false, 'Message sent; waiting for the counterparty'),
  ('committed',         6, true,  'Plan committed'),
  ('closed',            7, true,  'Declined or abandoned'),
  ('failed',            8, false, 'Technical failure; can be retried');

INSERT INTO deal_transition (from_status, to_status) VALUES
  ('ingesting',         'awaiting_confirm'),
  ('ingesting',         'failed'),
  ('ingesting',         'closed'),
  ('awaiting_confirm',  'computing'),
  ('awaiting_confirm',  'ingesting'),        -- re-extract
  ('awaiting_confirm',  'failed'),
  ('awaiting_confirm',  'closed'),
  ('computing',         'awaiting_approval'),
  ('computing',         'failed'),
  ('computing',         'closed'),
  ('awaiting_approval', 'awaiting_reply'),   -- send approved
  ('awaiting_approval', 'computing'),        -- owner picks another plan on the same inputs
  ('awaiting_approval', 'awaiting_confirm'), -- owner edits an input: re-confirm, re-evaluate
  ('awaiting_approval', 'committed'),        -- feasible as offered, no negotiation needed
  ('awaiting_approval', 'closed'),
  ('awaiting_approval', 'failed'),
  ('awaiting_reply',    'awaiting_confirm'), -- reply changes the terms: re-validate and re-confirm (ADR 0004)
  ('awaiting_reply',    'computing'),        -- reply accepts the ask: re-plan on the same inputs
  ('awaiting_reply',    'committed'),
  ('awaiting_reply',    'closed'),
  ('awaiting_reply',    'failed'),
  ('failed',            'ingesting'),
  ('failed',            'closed');
