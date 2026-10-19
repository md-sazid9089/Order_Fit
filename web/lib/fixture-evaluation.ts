import type { Deal, Evaluation, Review } from "./orderfit-api";

export function createMockEvaluationBundle(
  dealRef: string,
  businessId: string,
  draftData?: {
    orderValue?: number;
    customerName?: string;
    deliveryDate?: string;
    paymentTermsDays?: number;
    costItems?: Array<{ name: string; amount: number; date: string; deferrable?: boolean; kind?: string }>;
  } | null
): { deal: Deal; evaluation: Evaluation; review: Review } {
  const simulatedId = "00000000-0000-0000-0000-000000000002";
  const evalId = "00000000-0000-0000-0000-000000000003";
  const snapshotId = "00000000-0000-0000-0000-000000000004";
  const constraintsId = "00000000-0000-0000-0000-000000000005";
  const customerId = "00000000-0000-0000-0000-000000000006";

  const orderValueMinor = draftData?.orderValue ? String(draftData.orderValue * 100) : "36000000";
  const publicRef = dealRef || "PO-8841";
  const deliveryDate = draftData?.deliveryDate || "2026-12-14";
  const paymentDays = draftData?.paymentTermsDays ?? 45;

  const costItems = draftData?.costItems && draftData.costItems.length > 0
    ? draftData.costItems.map((c, i) => ({
        event_id: `cost-${i + 1}`,
        cost_key: `c${i + 1}`,
        event_date: c.date || "2026-11-04",
        amount_minor: String((c.amount || 0) * 100),
        kind: (c.kind as any) || "supplier_payment",
        is_deferrable: !!c.deferrable,
        incremental: true,
        nonincremental_reason: null,
        invoice_ref: null,
        payee_id: null,
        original_obligation_id: `obl-${i + 1}`,
        evidence: [],
      }))
    : [
        {
          event_id: "cost-1",
          cost_key: "c1",
          event_date: "2026-11-04",
          amount_minor: "9000000",
          kind: "supplier_payment" as const,
          is_deferrable: false,
          incremental: true,
          nonincremental_reason: null,
          invoice_ref: null,
          payee_id: null,
          original_obligation_id: "obl-1",
          evidence: [],
        },
        {
          event_id: "cost-2",
          cost_key: "c2",
          event_date: "2026-12-07",
          amount_minor: "9000000",
          kind: "supplier_payment" as const,
          is_deferrable: true,
          incremental: true,
          nonincremental_reason: null,
          invoice_ref: null,
          payee_id: null,
          original_obligation_id: "obl-2",
          evidence: [],
        },
      ];

  const deal: Deal = {
    id: simulatedId,
    public_ref: publicRef,
    status: "awaiting_approval",
    version: 1,
    input_version: 1,
    financial_revision: 1,
    currency: "USD",
    exponent: 2,
    start_date: "2026-11-02",
    opening_cash_minor: "21500000",
    order_value_minor: orderValueMinor,
    inputs: {
      opening_cash_minor: null,
      reserve_minor: "6000000",
      order_value_minor: orderValueMinor,
      order_date: "2026-11-02",
      invoice_date: "2026-12-14",
      delivery_date: deliveryDate,
      payment_basis: "delivery",
      payment_days: paymentDays,
      customer_id: customerId,
      constraints_id: constraintsId,
      costs: costItems,
    },
    live_evaluation_id: evalId,
    negotiation_round: 0,
    is_stale: false,
    findings: [],
    allowed_actions: ["inspect_result", "reopen_for_review", "hold", "close", "edit"],
  };

  const review: Review = {
    deal_id: simulatedId,
    version: 1,
    input_version: 1,
    financial_revision: 1,
    candidate_snapshot: null,
    snapshot_hash: "mock-hash",
    findings: [],
    required_field_ids: [],
  };

  const evaluation: Evaluation = {
    schema_version: "evaluation.v1",
    id: evalId,
    business_id: businessId || "e55482bc-1f2a-4017-a0dd-d3eeda7aabbd",
    deal_id: simulatedId,
    snapshot_id: snapshotId,
    input_version: 1,
    financial_revision: 1,
    snapshot_hash: "mock-hash",
    reference_input_hash: "mock-ref-hash",
    calculator_version: "ref-0.1.0",
    start_date: "2026-11-02",
    evaluated_at: new Date().toISOString(),
    decision: "accept_with_changes",
    reason_codes: [],
    baseline: [
      {
        scenario: "base",
        lowest_balance_minor: "15700000",
        lowest_headroom_minor: "9700000",
        first_breach_date: null,
        breaches: [],
        inherited_baseline_breaches: [],
        hard_feasible: true,
        meets_target: true,
      },
      {
        scenario: "downside",
        lowest_balance_minor: "14200000",
        lowest_headroom_minor: "8200000",
        first_breach_date: null,
        breaches: [],
        inherited_baseline_breaches: [],
        hard_feasible: true,
        meets_target: true,
      },
      {
        scenario: "severe",
        lowest_balance_minor: "9700000",
        lowest_headroom_minor: "3700000",
        first_breach_date: null,
        breaches: [],
        inherited_baseline_breaches: [],
        hard_feasible: true,
        meets_target: true,
      },
    ],
    as_is: {
      option_key: "accept_as_is",
      rank: null,
      parameters: {
        kind: "accept",
        deposit_pct: 0,
        extension: { days: 0, surcharge_bps: 0 },
        eligible_cost_keys: [],
        offer_id: null,
        draw_minor: "0",
      },
      base_incremental_profit_minor: "14000000",
      financing_cost_minor: "0",
      borrowed_minor: "0",
      profit_given_up_minor: "0",
      scenarios: [
        {
          scenario: "base",
          lowest_balance_minor: "-5900000",
          lowest_headroom_minor: "-11900000",
          first_breach_date: "2026-12-07",
          breaches: [{ start_date: "2026-12-07", end_date: "2027-01-28", worst_headroom_minor: "-11900000" }],
          inherited_baseline_breaches: [],
          hard_feasible: false,
          meets_target: false,
        },
        {
          scenario: "downside",
          lowest_balance_minor: "-7400000",
          lowest_headroom_minor: "-13400000",
          first_breach_date: "2026-12-07",
          breaches: [{ start_date: "2026-12-07", end_date: "2027-02-13", worst_headroom_minor: "-13400000" }],
          inherited_baseline_breaches: [],
          hard_feasible: false,
          meets_target: false,
        },
        {
          scenario: "severe",
          lowest_balance_minor: "-12760000",
          lowest_headroom_minor: "-18760000",
          first_breach_date: "2026-11-25",
          breaches: [{ start_date: "2026-11-25", end_date: "2027-03-14", worst_headroom_minor: "-18760000" }],
          inherited_baseline_breaches: [],
          hard_feasible: false,
          meets_target: false,
        },
      ],
      tolerance: {
        status: "fails_on_time",
        observed_safe_days: 0,
        first_failure_days: 0,
        scan_cap_days: 90,
      },
      hard_feasible: false,
      meets_target: false,
    },
    ranked_candidates: [
      {
        option_key: "dep40",
        rank: 1,
        parameters: {
          kind: "accept",
          deposit_pct: 40,
          extension: { days: 0, surcharge_bps: 0 },
          eligible_cost_keys: [],
          offer_id: null,
          draw_minor: "0",
        },
        base_incremental_profit_minor: "13280000",
        financing_cost_minor: "0",
        borrowed_minor: "0",
        profit_given_up_minor: "720000",
        scenarios: [
          {
            scenario: "base",
            lowest_balance_minor: "8212000",
            lowest_headroom_minor: "2212000",
            first_breach_date: null,
            breaches: [],
            inherited_baseline_breaches: [],
            hard_feasible: true,
            meets_target: true,
          },
          {
            scenario: "downside",
            lowest_balance_minor: "6712000",
            lowest_headroom_minor: "712000",
            first_breach_date: null,
            breaches: [],
            inherited_baseline_breaches: [],
            hard_feasible: true,
            meets_target: true,
          },
          {
            scenario: "severe",
            lowest_balance_minor: "-6360000",
            lowest_headroom_minor: "-12360000",
            first_breach_date: "2026-11-25",
            breaches: [{ start_date: "2026-11-25", end_date: "2027-01-16", worst_headroom_minor: "-12360000" }],
            inherited_baseline_breaches: [],
            hard_feasible: false,
            meets_target: false,
          },
        ],
        tolerance: {
          status: "first_failure",
          observed_safe_days: 27,
          first_failure_days: 28,
          scan_cap_days: 90,
        },
        hard_feasible: true,
        meets_target: true,
      },
      {
        option_key: "dep40+ext30",
        rank: 2,
        parameters: {
          kind: "accept",
          deposit_pct: 40,
          extension: { days: 30, surcharge_bps: 0 },
          eligible_cost_keys: ["c2"],
          offer_id: null,
          draw_minor: "0",
        },
        base_incremental_profit_minor: "13280000",
        financing_cost_minor: "0",
        borrowed_minor: "0",
        profit_given_up_minor: "720000",
        scenarios: [
          {
            scenario: "base",
            lowest_balance_minor: "8212000",
            lowest_headroom_minor: "2212000",
            first_breach_date: null,
            breaches: [],
            inherited_baseline_breaches: [],
            hard_feasible: true,
            meets_target: true,
          },
          {
            scenario: "downside",
            lowest_balance_minor: "6712000",
            lowest_headroom_minor: "712000",
            first_breach_date: null,
            breaches: [],
            inherited_baseline_breaches: [],
            hard_feasible: true,
            meets_target: true,
          },
          {
            scenario: "severe",
            lowest_balance_minor: "1230000",
            lowest_headroom_minor: "-4770000",
            first_breach_date: "2026-11-25",
            breaches: [{ start_date: "2026-11-25", end_date: "2027-01-07", worst_headroom_minor: "-4770000" }],
            inherited_baseline_breaches: [],
            hard_feasible: false,
            meets_target: false,
          },
        ],
        tolerance: {
          status: "first_failure",
          observed_safe_days: 40,
          first_failure_days: 41,
          scan_cap_days: 90,
        },
        hard_feasible: true,
        meets_target: true,
      },
    ],
    option_catalogue: [],
    recommended_option_key: "dep40",
    summary_scope: "recommended_base",
    assumptions: [
      "Customer payment terms: 45 days from delivery",
      "Supplier deposit required 40 days prior to delivery",
      "Baseline minimum cash reserve maintained at $60,000",
    ],
    coverage_through: "2027-03-31",
    coverage_gaps: [],
    voi_questions: [
      "Can the buyer agree to a 40% upfront deposit to eliminate negative cash flow during manufacturing?",
      "Can supplier terms on the secondary material batch be deferred by 30 days?",
    ],
    sensitivity: [
      {
        field: "scenarios.downside.order_receipt_delay_days",
        tested_value: 5,
        decision: "accept_with_changes",
        recommended_option_key: "dep40",
        profit_minor: "13280000",
      },
      {
        field: "scenarios.downside.order_receipt_delay_days",
        tested_value: 15,
        decision: "accept_with_changes",
        recommended_option_key: "dep40",
        profit_minor: "13280000",
      },
    ],
    alerts: [
      {
        code: "A1",
        field: "cash_runway",
        message: "As-is terms trigger a cash reserve shortfall of $119,000 on 2026-12-07.",
        blocking: false,
        resolution: "correct_input",
      },
    ],
    is_stale: false,
    stale_reasons: [],
    allowed_actions: ["confirm", "negotiate", "export"],
  };

  return { deal, evaluation, review };
}
