"""Map stored financial facts to overview.v1 without inventing accounts or FX."""

from datetime import date, timedelta
from decimal import Decimal

from orderfit.agent.nodes.compute import portfolio_trough
from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import MAX_MONEY
from orderfit.contracts.resources import BusinessOverviewView

CURRENCIES = {
    "BDT": ("Bangladeshi Taka", "৳"),
    "USD": ("US Dollar", "$"),
    "EUR": ("Euro", "€"),
    "GBP": ("Pound Sterling", "£"),
}
WINDOW_DAYS = {"30d": 30, "90d": 90, "6m": 183, "1y": 365}
LABELS = {
    "safe": "Feasible as-is",
    "deposit": "Deposit required",
    "split": "Split milestones",
    "financing": "Financing needed",
    "declined": "Decline or renegotiate",
    "review": "Review revised terms",
}


def money(value):
    value = int(value)
    if abs(value) > MAX_MONEY:
        raise ApplicationError(
            422, "OVERVIEW_MONEY_BOUND", "Aggregate exceeds supported monetary bounds."
        )
    return str(value)


def percent_change(current, previous):
    # No finite growth percentage exists from zero to nonzero. Caller adds a warning.
    return float(Decimal(current - previous) * 100 / abs(previous)) if previous else 0.0


def liquidity_status(trough, reserve):
    return "breach" if trough < reserve else "warning" if trough == reserve else "safe"


def cashflow(events, start, timeframe):
    end = start + timedelta(days=WINDOW_DAYS[timeframe] - 1)
    buckets = {}
    day = start
    while day <= end:
        key = day.strftime("%Y-%m") if timeframe in {"6m", "1y"} else str((day - start).days // 7)
        bucket = buckets.setdefault(key, dict(first=day, last=day, inflow=0, outflow=0))
        bucket["last"] = day
        day += timedelta(days=1)
    for event in events:
        day = event["date"]
        if start <= day <= end:
            key = (
                day.strftime("%Y-%m") if timeframe in {"6m", "1y"} else str((day - start).days // 7)
            )
            buckets[key]["inflow" if event["direction"] == "in" else "outflow"] += event["amount"]
    points = [
        dict(
            period_key=key if timeframe in {"6m", "1y"} else b["first"].isoformat(),
            date_range=f"{b['first'].isoformat()}/{b['last'].isoformat()}",
            inflow_minor=money(b["inflow"]),
            outflow_minor=money(b["outflow"]),
            net_minor=money(b["inflow"] - b["outflow"]),
            highlight_note=None,
        )
        for key, b in buckets.items()
    ]
    inflow = sum(b["inflow"] for b in buckets.values())
    outflow = sum(b["outflow"] for b in buckets.values())
    return dict(
        total_inflow_minor=money(inflow),
        total_outflow_minor=money(outflow),
        total_net_minor=money(inflow - outflow),
        timeline=points,
    )


def build_overview(row, timeframe, currency):
    primary = row["currency"].strip()
    if currency is not None and currency != primary:
        raise ApplicationError(
            422,
            "OVERVIEW_CURRENCY_UNSUPPORTED",
            "Only the business currency is available; FX conversion is unsupported.",
        )
    baseline = row["baseline_settings"] or {}
    configured = "opening_cash_minor" in baseline
    start = date.fromisoformat(baseline["opening_date"]) if configured else row["today"]
    opening = int(baseline["opening_cash_minor"]) if configured else 0
    reserve = int(row["reserve"])
    warnings = [
        "BALANCE_HISTORY_UNAVAILABLE",
        "PENDING_HISTORY_UNAVAILABLE",
        "HEADROOM_HISTORY_UNAVAILABLE",
        "SINGLE_CURRENCY_BASELINE_ONLY",
        "SPLIT_MILESTONES_UNSUPPORTED",
        "RECENT_SETTLEMENTS_ARE_EVALUATIONS",
        "PROJECTIONS_ARE_SANDBOX",
    ]
    if not configured:
        warnings.append("BASELINE_NOT_CONFIGURED")
    if not row["previous_volume"] and row["volume"]:
        warnings.append("VOLUME_CHANGE_UNDEFINED_FROM_ZERO")
    events = (
        [
            dict(
                date=date.fromisoformat(e["event_date"]),
                amount=int(e["amount"]),
                direction=e["direction"],
                delayed=e["delayed"],
            )
            for e in row["events"]
        ]
        if configured
        else []
    )
    if any(e["date"] < start for e in events):
        warnings.append("PAST_EVENTS_REQUIRE_RECONCILIATION")
    events = [e for e in events if e["date"] >= start]
    end = max(
        [
            start + timedelta(days=WINDOW_DAYS[timeframe] - 1),
            *[e["date"] + timedelta(days=60 if e["delayed"] else 0) for e in events],
        ]
    )
    if (end - start).days > 540 or end > date(2100, 12, 31):
        raise ApplicationError(
            422,
            "OVERVIEW_HORIZON_UNSUPPORTED",
            "Complete delayed projection exceeds the supported 540-day horizon.",
        )
    # Validate gross exposure too: cancellation of huge inflows/outflows cannot hide overflow.
    money(opening)
    money(reserve)
    money(row["previous_volume"])
    money(abs(opening) + sum(e["amount"] for e in events))
    if configured and date.fromisoformat(baseline["coverage_through"]) < end:
        warnings.append("BASELINE_COVERAGE_INCOMPLETE")
    scenarios = []
    for delay in (0, 15, 30, 45, 60):
        trough = portfolio_trough(opening, events, start, end, delay)
        status = liquidity_status(trough, reserve) if configured else "warning"
        if status == "safe" and any(
            w in warnings
            for w in ("BASELINE_COVERAGE_INCOMPLETE", "PAST_EVENTS_REQUIRE_RECONCILIATION")
        ):
            status = "warning"
        guidance = {
            "safe": "Recorded obligations remain above the reserve floor.",
            "warning": "Review baseline coverage and reserve headroom before committing.",
            "breach": "Review earlier customer receipts, revised terms or financing before committing.",
        }[status]
        scenarios.append(
            dict(
                delay_days=delay,
                label="On-Time (Base)" if not delay else f"+{delay}d Customer Delay",
                projected_trough_minor=money(trough),
                reserve_floor_minor=money(reserve),
                status=status,
                recommendation=guidance,
            )
        )
    dist = row["distribution"]
    if dist.get("unclassified") or dist.get("declined"):
        warnings.append("VERDICT_DISTRIBUTION_EXCLUDES_DECLINED_AND_UNCLASSIFIED")
    names = {
        "feasible_as_is": "safe",
        "deposit_required": "deposit",
        "split_milestones": "split",
        "financing_needed": "financing",
    }
    total = sum(dist.get(k, 0) for k in names.values())
    distribution = {f"{name}_count": dist.get(category, 0) for name, category in names.items()}
    distribution.update(
        {
            f"{name}_pct": float(Decimal(dist.get(category, 0)) * 100 / total) if total else 0.0
            for name, category in names.items()
        }
    )
    recent = []
    for item in row["recent"]:
        terms = item["terms"] or {}
        category = item["category"]
        if category == "unclassified":
            category = "review"
            if "RECENT_STATUS_REQUIRES_REVIEW" not in warnings:
                warnings.append("RECENT_STATUS_REQUIRES_REVIEW")
        recent.append(
            dict(
                id=str(item["id"]),
                deal_id=item["deal_id"],
                customer_name=item["customer_name"],
                public_ref=item["public_ref"],
                order_no=item["po_number"],
                amount_minor=money(item["amount"]),
                terms=f"{terms.get('payment_days')} days from {terms.get('payment_basis')}"
                if terms.get("payment_basis")
                else "Unconfirmed terms",
                status=category,
                status_label=LABELS[category],
                evaluated_at=item["created_at"],
            )
        )
    balances = []
    if configured and opening >= 0:
        name, symbol = CURRENCIES[primary]
        balances.append(
            dict(
                code=primary,
                name=name,
                symbol=symbol,
                amount_minor=money(opening),
                pct_allocation=100.0 if opening else 0.0,
                tag="Opening baseline",
            )
        )
    elif opening < 0:
        warnings.append("NEGATIVE_BALANCE_NOT_REPRESENTABLE_IN_CURRENCY_ALLOCATION")
    return BusinessOverviewView.model_validate(
        dict(
            business_id=row["id"],
            primary_currency=primary,
            as_of=start,
            reserve_floor_minor=money(reserve),
            kpis=dict(
                total_balance_minor=money(opening),
                total_balance_change_pct=0.0,
                volume_30d_minor=money(row["volume"]),
                volume_30d_change_pct=percent_change(
                    int(row["volume"]), int(row["previous_volume"])
                ),
                total_orders_tested=row["tested"],
                pending_reviews_count=row["pending"],
                pending_reviews_change_pct=0.0,
                protected_headroom_minor=money(
                    int(scenarios[0]["projected_trough_minor"]) - reserve
                )
                if configured
                else "0",
                protected_headroom_status=scenarios[0]["status"],
                protected_headroom_change_pct=0.0,
            ),
            cashflow=cashflow(events, start, timeframe),
            delay_sensitivity=scenarios,
            verdict_distribution=distribution,
            recent_settlements=recent,
            currency_balances=balances,
            data_warnings=warnings,
        )
    )
