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
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const simulatedId = UUID_REGEX.test(dealRef) ? dealRef : "00000000-0000-0000-0000-000000000002";
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
    input_version: 3,
    financial_revision: 20,
    candidate_snapshot: {
      schema_version: "confirmed-input.v1",
      business_id: businessId || "e55482bc-1f2a-4017-a0dd-d3eeda7aabbd",
      deal_id: simulatedId,
      input_version: 3,
      financial_revision: 20,
      source_revisions: [
        {
          resource_kind: "payee",
          resource_id: "c0c41819-2638-408f-b568-da9f95f402a5",
          revision: 1,
          content_hash: "bfb75d02b3297c6778b8f4b1a3e1e4addbd6683de1c63c3ba370b119b208f2a8",
        },
        {
          resource_kind: "customer",
          resource_id: "99a92c34-757c-4bcd-b252-e385afba5df4",
          revision: 1,
          content_hash: "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
        },
        {
          resource_kind: "constraints",
          resource_id: constraintsId,
          revision: 1,
          content_hash: "4fb9fbebc390b0fa79362e5741891d4a71da5ecd9629b6524635026ecdf8bb3c",
        },
      ],
      start_date: "2026-11-02",
      currency: "USD",
      exponent: 2,
      opening_cash_minor: "21500000",
      reserve_minor: "6000000",
      baseline_revision: 1,
      coverage_through: "2027-02-15",
      balance_evidence: [],
      baseline_events: [],
      order: {
        customer_id: customerId,
        order_date: "2026-11-02",
        order_value_minor: orderValueMinor,
        invoice_date: "2026-12-14",
        delivery_date: deliveryDate,
        payment_basis: "delivery",
        payment_days: paymentDays,
        costs: costItems,
      },
      offers: [],
      owner: {
        cash_reserve_floor_minor: "6000000",
        min_gross_margin_pct: "15.0",
      },
      strategy_space: {
        deposit_pct_options: [0, 20, 30, 40, 50],
        financing_options: [],
      },
      scenarios: {
        downside: {
          customer_delay_days: 14,
          ar_delay_days: 14,
          cost_overrun_bps: 500,
        },
        severe: {
          customer_delay_days: 30,
          ar_delay_days: 30,
          cost_overrun_bps: 1200,
        },
      },
      analysis: {
        cash_burn_daily_minor: "45000",
      },
      assumptions: [
        "Supplier terms require 50% advance deposit at order booking",
        "Final balance settlement on container physical delivery",
      ],
      conflict_resolutions: [],
      coverage_acknowledgement: null,
    } as any,
    snapshot_hash: "4fb9fbebc390b0fa79362e5741891d4a71da5ecd9629b6524635026ecdf8bb3c",
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

export function createMockSeriesPoints(
  scenario: "base" | "downside" | "severe",
  optionKey: string
): { date: string; candidate_trough_minor: string; reserve_minor: string }[] {
  // Deterministic daily date points from 2026-11-02 through 2026-12-28
  const dates = [
    "2026-11-02",
    "2026-11-04",
    "2026-11-09",
    "2026-11-16",
    "2026-11-23",
    "2026-11-30",
    "2026-12-04",
    "2026-12-07",
    "2026-12-10",
    "2026-12-14",
    "2026-12-21",
    "2026-12-28",
  ];

  const reserveMinor = "6000000"; // $60,000 reserve floor

  // Different profiles depending on whether as-is (unmitigated shortfall) or mitigated (dep40)
  const isAsIs = optionKey === "accept_as_is";

  return dates.map((date) => {
    let troughMinor: string;

    if (isAsIs) {
      if (date === "2026-11-02") troughMinor = "21500000";
      else if (date === "2026-11-04") troughMinor = "12500000";
      else if (date === "2026-11-09") troughMinor = "12200000";
      else if (date === "2026-11-16") troughMinor = "11800000";
      else if (date === "2026-11-23") troughMinor = "10500000";
      else if (date === "2026-11-30") troughMinor = "9200000";
      else if (date === "2026-12-04") troughMinor = "8400000";
      else if (date === "2026-12-07") {
        // Supplier balance due: triggers shortfall in as-is
        troughMinor = scenario === "severe" ? "-12760000" : scenario === "downside" ? "-7400000" : "-5900000";
      } else if (date === "2026-12-10") {
        troughMinor = scenario === "severe" ? "-15760000" : scenario === "downside" ? "-10400000" : "-8900000";
      } else if (date === "2026-12-14") {
        troughMinor = scenario === "severe" ? "-16760000" : scenario === "downside" ? "-11400000" : "-9900000";
      } else if (date === "2026-12-21") {
        troughMinor = scenario === "severe" ? "-14000000" : scenario === "downside" ? "-9000000" : "8000000";
      } else {
        troughMinor = scenario === "severe" ? "9700000" : scenario === "downside" ? "14200000" : "15700000";
      }
    } else {
      // dep40 or dep40+ext30 candidate option: customer 40% upfront deposit injects +$144,000 early
      if (date === "2026-11-02") troughMinor = "21500000";
      else if (date === "2026-11-04") troughMinor = "26900000"; // deposit arrived, materials paid
      else if (date === "2026-11-09") troughMinor = "26500000";
      else if (date === "2026-11-16") troughMinor = "25800000";
      else if (date === "2026-11-23") troughMinor = "24200000";
      else if (date === "2026-11-30") troughMinor = "22800000";
      else if (date === "2026-12-04") troughMinor = "21900000";
      else if (date === "2026-12-07") {
        troughMinor = scenario === "severe" ? "1230000" : scenario === "downside" ? "6712000" : "8212000";
      } else if (date === "2026-12-10") {
        troughMinor = scenario === "severe" ? "980000" : scenario === "downside" ? "6200000" : "7800000";
      } else if (date === "2026-12-14") {
        troughMinor = scenario === "severe" ? "850000" : scenario === "downside" ? "5900000" : "7500000";
      } else if (date === "2026-12-21") {
        troughMinor = scenario === "severe" ? "2100000" : scenario === "downside" ? "8500000" : "12400000";
      } else {
        troughMinor = scenario === "severe" ? "12000000" : scenario === "downside" ? "18500000" : "24800000";
      }
    }

    return {
      date,
      candidate_trough_minor: troughMinor,
      reserve_minor: reserveMinor,
    };
  });
}

export function createMockOptionCatalogue(evalId: string): any {
  return {
    evaluation_id: evalId,
    is_stale: false,
    options: [
      {
        option_key: "dep40",
        hard_feasible: true,
        base_incremental_profit_minor: "13280000",
        parameters: {
          kind: "accept",
          deposit_pct: 40,
          extension: { days: 0, surcharge_bps: 0 },
          eligible_cost_keys: [],
          offer_id: null,
          draw_minor: "0",
        },
      },
      {
        option_key: "dep40+ext30",
        hard_feasible: true,
        base_incremental_profit_minor: "13120000",
        parameters: {
          kind: "accept",
          deposit_pct: 40,
          extension: { days: 30, surcharge_bps: 120 },
          eligible_cost_keys: ["c2"],
          offer_id: null,
          draw_minor: "0",
        },
      },
      {
        option_key: "accept_as_is",
        hard_feasible: false,
        base_incremental_profit_minor: "14000000",
        parameters: {
          kind: "accept",
          deposit_pct: 0,
          extension: { days: 0, surcharge_bps: 0 },
          eligible_cost_keys: [],
          offer_id: null,
          draw_minor: "0",
        },
      },
    ],
  };
}

export function createMockPreparationState(dealId: string): any {
  return {
    deal_id: dealId,
    forks: [],
    messages: [
      {
        identity: {
          message_id: "msg-001",
          party_id: "00000000-0000-0000-0000-000000000006",
          party_role: "customer",
          recipient: "procurement@apexretailers.com",
          channel: "email",
          subject: "Proposed order terms for review · PO-3950",
          body: "Dear Apex Retailers Team,\n\nThank you for the opportunity to partner on order PO-3950. Based on our manufacturing cashflow analysis, we can accept this production run with revised terms: a 40% upfront deposit ($144,000) prior to tooling, with the balance due Net 45 from delivery on 14 Dec 2026.\n\nPlease confirm if this revised schedule meets your approval.\n\nWarm regards,\nCommercial Lead",
          evaluation_id: "00000000-0000-0000-0000-000000000003",
          option: {
            option_key: "dep40",
            hard_feasible: true,
            base_incremental_profit_minor: "13280000",
            parameters: {
              kind: "accept",
              deposit_pct: 40,
              extension: { days: 0, surcharge_bps: 0 },
              eligible_cost_keys: [],
              offer_id: null,
              draw_minor: "0",
            },
          },
          revision: 1,
        },
        preparation_hash: "mock-prep-hash-40",
        provenance: "live",
        is_stale: false,
        reviewed: true,
        blockers: [],
        edit_sentences: [
          "Thank you for the opportunity to partner on order PO-3950.",
          "Please confirm if this revised schedule meets your approval.",
        ],
      },
    ],
    replies: [],
    acceptances: [],
    clause_assessments: [],
    operations: [],
    has_more: false,
  };
}


