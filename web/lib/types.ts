/**
 * OrderFit Web Client Domain & API Types
 * Grounded in docs/architecture/orderfit/04-decision-engine-and-data-contracts.md
 */

export interface Money {
  amount_minor: number;
  currency: string;
}

export type Provenance = "uploaded" | "extracted" | "user_confirmed" | "assumed" | "derived";
export type Certainty = "confirmed" | "expected" | "assumed";

export type CashEventKind =
  | "payroll"
  | "rent"
  | "debt_service"
  | "supplier"
  | "tax"
  | "capex"
  | "customer_receipt"
  | "financing_draw"
  | "financing_fee"
  | "financing_repay";

export interface CashEvent {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  amount_minor: number;
  direction: "in" | "out";
  kind: CashEventKind;
  certainty: Certainty;
  scope: "baseline" | "order" | "financing";
  provenance: Provenance;
  counterparty?: string;
  invoice_ref?: string;
  note?: string;
}

export type DealStatus =
  | "draft"
  | "ingested"
  | "awaiting_confirm"
  | "confirmed"
  | "evaluating"
  | "recommended"
  | "awaiting_approval"
  | "approved"
  | "awaiting_reply"
  | "replied"
  | "committed"
  | "blocked"
  | "failed"
  | "compensating";

export interface Deal {
  id: string;
  business_id: string;
  customer_id: string;
  po_number: string;
  customer_name?: string;
  status: DealStatus;
  input_version: number;
  as_of: string;
  currency: string;
  order_value_minor?: number;
  incremental_costs_minor?: number;
  delivery_date?: string;
  payment_terms?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExtractedField {
  id: string;
  name: string;
  raw_value: string;
  normalized_value: unknown;
  confidence: number;
  source_page?: number;
  source_quote?: string;
  provenance: Provenance;
  confirmed: boolean;
}

export type FlagKind = "ambiguity" | "fraud" | "injection" | "breach" | "mismatch";
export type FlagSeverity = "info" | "warning" | "blocking";

export interface DealFlag {
  id: string;
  deal_id: string;
  kind: FlagKind;
  severity: FlagSeverity;
  message: string;
  rule_id?: string;
  source_field?: string;
  resolved: boolean;
}

export interface ScenarioResult {
  headroom: number;
  feasible: boolean;
  lowest_balance?: Money;
  first_shortfall_date?: string;
  max_funding_gap?: Money;
}

export interface RankedOption {
  strategy_id: string;
  label?: string;
  dependencies: string[];
  net_order_profit: Money;
  financing_cost: Money;
  concession: Money;
  resilience: number;
  meets_target_resilience: boolean;
  delay_tolerance_days?: number;
  borrowed_minor?: number;
  base: ScenarioResult;
  downside: ScenarioResult;
  severe: ScenarioResult;
}

export interface DailyBalancePoint {
  date: string;
  baseline_balance: number;
  order_balance: number;
  reserve_floor: number;
  headroom: number;
  is_breach: boolean;
}

export interface EvaluationResult {
  evaluation_id: string;
  deal_id: string;
  input_version: number;
  as_of: string;
  input_hash: string;
  calc_version: string;
  status: "current" | "stale" | "voided";
  decision: "accept_as_is" | "accept_with_changes" | "decline" | "blocked";
  recommended: string;
  profit_given_up_for_resilience?: Money;
  best_profit_strategy?: string;
  baseline: {
    lowest_balance: Money;
    lowest_date: string;
    pre_existing_breach: boolean;
  };
  accept_as_is: {
    lowest_balance: Money;
    first_shortfall_date?: string;
    max_funding_gap?: Money;
    feasible: boolean;
  };
  ranked: RankedOption[];
  assumptions?: Array<{ name: string; value: unknown; prov: Provenance }>;
  flags?: DealFlag[];
  alerts?: Record<string, unknown[]>;
  explanation?: {
    text: string;
    verified: boolean;
  };
}

export interface Approval {
  id: string;
  deal_id: string;
  evaluation_id: string;
  plan_hash: string;
  action_ids: string[];
  status: "pending" | "valid" | "voided" | "executed";
  step_up_code?: string;
  created_at: string;
  approved_by?: string;
}

export interface SandboxAction {
  id: string;
  deal_id: string;
  kind: "message" | "payment" | "term_sheet";
  status: "drafted" | "approved" | "executing" | "executed" | "failed" | "voided";
  payload: Record<string, unknown>;
  idempotency_key: string;
  executed_at?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    field?: string | null;
    escalation_code?: string | null;
  };
  request_id: string;
}
