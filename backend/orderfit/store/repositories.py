"""Bound persistence queries; services own transactions and permissions."""

import json
from datetime import UTC, date, datetime
from uuid import UUID, uuid4

from pydantic import ValidationError
from sqlalchemy import select, text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.financial import (
    AnalysisConfig,
    BaselineEvent,
    ConfirmedInputV1,
    CostInput,
    Evidence,
    OrderInput,
    OwnerSettings,
    Scenarios,
    SourceRevision,
    StrategySpace,
    Stress,
    TermLoan,
)
from orderfit.contracts.primitives import Page, ReasonCommand, RevisionReason
from orderfit.contracts.protocol import canonical_bytes, canonical_hash
from orderfit.contracts.resources import (
    AccountView,
    BaselineBalance,
    BaselineView,
    BaselineWrite,
    BusinessProfile,
    BusinessView,
    CashEventCreate,
    CashEventDuplicateMatch,
    CashEventDuplicates,
    CashEventInput,
    CashEventView,
    CashEventWrite,
    ConstraintsView,
    ConstraintWrite,
    CustomerCreate,
    CustomerInput,
    CustomerView,
    CustomerWrite,
    DealView,
    DealWrite,
    DraftInputs,
    FlagResolution,
    OfferCreate,
    OfferView,
    OfferWrite,
    PayeeCreate,
    PayeeInput,
    PayeeView,
    PayeeWrite,
)
from orderfit.contracts.workflow import (
    ConfirmInputs,
    CreateDeal,
    EvaluationResultV1,
    Finding,
    Review,
    Series,
    SeriesPoint,
    SnapshotConfirmed,
)
from orderfit.services.evaluations import extract_series
from orderfit.store import baseline_duplicates
from orderfit.store.collection_page import collection_page
from orderfit.store.tables import (
    app_user,
    business,
    cash_event,
    customer,
    deal,
    evaluation,
    evaluation_series,
    financing_offer,
    owner_constraints,
    payee,
)


def append_audit(c, scope, action: str, *, deal_id=None, payload=None, outcome="completed"):
    return (
        c.execute(
            text(
                "INSERT INTO operation_log(business_id,deal_id,actor,actor_user_id,tier,action,outcome,payload) VALUES(:b,:d,'system',:u,:tier,:action,:outcome,CAST(:payload AS jsonb)) RETURNING id,seq,row_hash"
            ),
            {
                "b": scope.business_id,
                "d": deal_id,
                "u": scope.user_id,
                "tier": {
                    "owner": "T3",
                    "risk_officer": "T3",
                    "commercial_lead": "T2",
                    "viewer": "T0",
                    "auditor": "T0",
                }.get(scope.role),
                "action": action,
                "outcome": outcome,
                "payload": json.dumps(payload or {}),
            },
        )
        .mappings()
        .one()
    )


class IdempotencyRepository:
    @staticmethod
    def lookup(c, business_id, key, scope, request_hash):
        """Read a live replay before expensive work, without reserving a command.

        Admission must still call reserve() in the mutation transaction: a concurrent
        command may complete after this read. No pending key is committed separately.
        """
        row = c.execute(
            text("SELECT scope,request_hash,status,response FROM idempotency_key "
                 "WHERE business_id=:b AND key=:k AND expires_at>clock_timestamp()"),
            {"b": business_id, "k": key},
        ).mappings().one_or_none()
        if row is None:
            return None
        if bytes(row["request_hash"]) != request_hash or row["scope"] != scope:
            raise ApplicationError(409, "IDEMPOTENCY_CONFLICT")
        if row["status"] != "completed":
            raise ApplicationError(409, "OPERATION_IN_PROGRESS")
        return row["response"]

    @staticmethod
    def reserve(c, business_id, key, scope, request_hash):
        if not key or not key.strip() or len(key) > 200:
            raise ApplicationError(422, "INVALID_IDEMPOTENCY_KEY")
        c.execute(
            text(
                "DELETE FROM idempotency_key WHERE business_id=:b AND key=:k AND expires_at<=clock_timestamp()"
            ),
            {"b": business_id, "k": key},
        )
        inserted = c.execute(
            text(
                "INSERT INTO idempotency_key(business_id,key,scope,request_hash) VALUES(:b,:k,:scope,:hash) ON CONFLICT DO NOTHING RETURNING key"
            ),
            {"b": business_id, "k": key, "scope": scope, "hash": request_hash},
        ).scalar_one_or_none()
        row = (
            c.execute(
                text("SELECT * FROM idempotency_key WHERE business_id=:b AND key=:k FOR UPDATE"),
                {"b": business_id, "k": key},
            )
            .mappings()
            .one()
        )
        if bytes(row["request_hash"]) != request_hash or row["scope"] != scope:
            raise ApplicationError(409, "IDEMPOTENCY_CONFLICT")
        if inserted is None and row["status"] != "completed":
            raise ApplicationError(409, "OPERATION_IN_PROGRESS")
        return row["response"] if inserted is None else None

    @staticmethod
    def complete(c, business_id, key, response):
        c.execute(
            text(
                "UPDATE idempotency_key SET status='completed',response=CAST(:r AS jsonb) WHERE business_id=:b AND key=:k"
            ),
            {"r": json.dumps(response), "b": business_id, "k": key},
        )


def _check_mutation_versions(c, scope, row, command):
    if row["version"] != command.expected_version:
        raise ApplicationError(409, "STALE_VERSION")
    revision = c.execute(text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}).scalar_one()
    if revision != command.expected_financial_revision:
        raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
    if hasattr(command, "expected_input_version") and row["input_version"] != command.expected_input_version:
        raise ApplicationError(409, "STALE_INPUT_VERSION")


def _bank_change_resolution(c, scope, deal_id, flag, req):
    """P7 evidence path for a P5 bank-change hold (guarded again by SQL p6_bank_blocker).

    Requires a current T3 actor, the exact bank-change reply on this deal, a verified account
    of that reply's party and written evidence. No other route can clear this hold.
    """
    from orderfit.contracts.protocol import PERMISSIONS
    from orderfit.store import account_repository

    resolution = req.bank_verification
    if resolution is None:
        raise ApplicationError(409, "BANK_VERIFICATION_REQUIRED")
    if scope.role not in PERMISSIONS["execute"]:
        raise ApplicationError(403, "FORBIDDEN")
    reply = account_repository.bank_change_reply(c, scope.business_id, deal_id, resolution.reply_id)
    account = account_repository.account_by_id(c, scope.business_id, resolution.account_id)
    if reply is None or account is None:
        raise ApplicationError(404, "NOT_FOUND")
    if not reply["bank_change"]:
        raise ApplicationError(409, "NOT_A_BANK_CHANGE_REPLY")
    if str(account["payee_id"]) != reply["party_id"]:
        raise ApplicationError(409, "ACCOUNT_PARTY_MISMATCH")
    if account["status"] != "verified":
        raise ApplicationError(409, "ACCOUNT_NOT_VERIFIED")
    resolution_id = account_repository.insert_bank_resolution(
        c, scope.business_id, deal_id, flag["id"], resolution.reply_id, resolution.account_id,
        scope.user_id, resolution.written_evidence, bytes(account["account_fingerprint"]),
    )
    c.execute(text("SELECT set_config('app.bank_resolution_id',:r,true)"), {"r": str(resolution_id)})
    return {"bank_resolution_id": str(resolution_id), "reply_id": str(resolution.reply_id),
            "account_id": str(resolution.account_id)}


class IdentityRepository:
    @staticmethod
    def lookup(c, email):
        return (
            c.execute(text("SELECT * FROM auth_lookup(:email)"), {"email": email})
            .mappings()
            .one_or_none()
        )

    @staticmethod
    def profile(c, scope):
        user = (
            c.execute(
                select(app_user).where(app_user.c.id == scope.user_id),
            )
            .mappings()
            .one()
        )
        memberships = (
            c.execute(
                text("SELECT business_id,business_name,role FROM user_businesses(:u)"),
                {"u": scope.user_id},
            )
            .mappings()
            .all()
        )
        return user, memberships


class BusinessRepository:
    @staticmethod
    def get_profile(c, business_id: UUID) -> BusinessView:
        row = (
            c.execute(
                select(business).where(business.c.id == business_id),
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        prof = row["profile"] or {}
        return BusinessView(
            id=row["id"],
            version=row["version"],
            financial_revision=row["financial_revision"],
            currency=row["currency"],
            exponent=2,
            profile=BusinessProfile(
                name=row["name"],
                timezone=row["timezone"],
                address=prof.get("address"),
                phone=prof.get("phone"),
                trade_registration=prof.get("trade_registration"),
                tax_id=prof.get("tax_id"),
            ),
        )

    @staticmethod
    def get_baseline(c, business_id: UUID) -> BaselineView:
        row = (
            c.execute(
                select(business).where(business.c.id == business_id),
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        bs = row["baseline_settings"] or {}
        if not bs or "opening_cash_minor" not in bs:
            raise ApplicationError(409, "BASELINE_NOT_CONFIGURED")
        balance = BaselineBalance.model_validate(bs)
        return BaselineView(
            version=row["version"],
            financial_revision=row["financial_revision"],
            balance=balance,
        )

    @staticmethod
    def update_baseline(c, scope, req: BaselineWrite) -> BaselineView:
        row = (
            c.execute(
                text("SELECT * FROM business WHERE id=:b FOR UPDATE"),
                {"b": scope.business_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        if row["version"] != req.expected_version:
            raise ApplicationError(409, "STALE_VERSION")
        if row["financial_revision"] != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        bs_dump = req.balance.model_dump(mode="json")
        c.execute(
            text(
                "UPDATE business SET baseline_settings = CAST(:bs AS jsonb), financial_revision = financial_revision + 1, version = version + 1 WHERE id = :b"
            ),
            {"bs": json.dumps(bs_dump), "b": scope.business_id},
        )
        append_audit(c, scope, "update_baseline", payload={"balance": bs_dump})
        return BaselineView(
            version=row["version"] + 1,
            financial_revision=row["financial_revision"] + 1,
            balance=req.balance,
        )


def _row_to_constraints(row, default_id: UUID | None, fin_rev: int) -> ConstraintsView:
    strat = row["strategy_space"] or {}
    stg = strat.get("stages", 1)
    if isinstance(stg, list):
        stg = stg[0] if stg else 1
    exts = strat.get("extensions")
    if not exts:
        exts = [{"days": 0, "surcharge_bps": 0}]
    strategy_space = StrategySpace(
        deposit_pcts=strat.get("deposit_pcts", [0]),
        deposit_lead_days=row["deposit_lead_days"],
        extensions=exts,
        offer_ids=strat.get("offer_ids", []),
        stages=stg,
    )
    scenarios = Scenarios(
        downside=Stress(
            order_receipt_delay_days=row["downside_order_delay_days"],
            ar_delay_days=row["downside_ar_delay_days"],
            cost_overrun_bps=row["downside_cost_overrun_bps"],
            deposit_follows_delay=row["downside_deposit_follows_delay"],
            order_receipt_haircut_bps=row["downside_order_receipt_haircut_bps"],
        ),
        severe=Stress(
            order_receipt_delay_days=row["severe_order_delay_days"],
            ar_delay_days=row["severe_ar_delay_days"],
            cost_overrun_bps=row["severe_cost_overrun_bps"],
            deposit_follows_delay=row["severe_deposit_follows_delay"],
            order_receipt_haircut_bps=row.get("severe_order_receipt_haircut_bps") or 0,
        ),
    )
    owner = OwnerSettings(
        priorities=row["priorities"] or ["profit", "independence_customer", "simplicity"],
        min_order_profit_minor=str(row["min_order_profit_minor"]),
        max_financing_cost_minor=str(row["max_financing_cost_minor"])
        if row["max_financing_cost_minor"] is not None
        else None,
        target_scenario=row["target_scenario"],
        close_call_bps=row["close_call_bps"],
        max_deposit_concession_bps=row["max_deposit_concession_bps"],
        max_supplier_extension_days=row["max_supplier_extension_days"],
        max_negotiation_rounds=row["max_negotiation_rounds"] or 3,
        # These stored columns are inert in the supported engine contract. Do not
        # activate legacy numeric defaults merely by reading a constraint row.
        min_delay_tolerance_days=None,
        max_customer_concentration_bps=None,
        max_financing_cost_bps=None,
        constraints_id=row["id"],
        version=row["version"],
    )
    return ConstraintsView(
        id=row["id"],
        version=row["version"],
        financial_revision=fin_rev,
        reserve_minor=str(row["safety_reserve_minor"]),
        owner=owner,
        strategy_space=strategy_space,
        scenarios=scenarios,
        is_default=(row["id"] == default_id),
    )


class ConstraintsRepository:
    @staticmethod
    def list_constraints(
        c, business_id: UUID, limit: int = 50, offset: int = 0, *, cursor=None, cursors=None, scope=None,
        default_only=False
    ) -> Page[ConstraintsView]:
        b = (
            c.execute(
                text("SELECT default_constraints_id, financial_revision FROM business WHERE id=:b"),
                {"b": business_id},
            )
            .mappings()
            .one_or_none()
        )
        if not b:
            raise ApplicationError(404, "NOT_FOUND")
        query = select(owner_constraints).where(owner_constraints.c.business_id == business_id)
        if default_only:
            query = query.where(owner_constraints.c.id == b["default_constraints_id"])
        rows, continuation = collection_page(
            c, query, owner_constraints, business_id, owner_constraints.c.version, limit, offset,
            cursor=cursor, cursors=cursors, scope=scope, filters={"default_only": default_only})
        items = [_row_to_constraints(r, b["default_constraints_id"], b["financial_revision"]) for r in rows]
        return Page(items=items, next_cursor=continuation)

    @staticmethod
    def get_constraints(c, business_id: UUID, constraints_id: UUID) -> ConstraintsView:
        b = (
            c.execute(
                text("SELECT default_constraints_id, financial_revision FROM business WHERE id=:b"),
                {"b": business_id},
            )
            .mappings()
            .one_or_none()
        )
        if not b:
            raise ApplicationError(404, "NOT_FOUND")
        row = (
            c.execute(
                select(owner_constraints).where(
                    owner_constraints.c.business_id == business_id,
                    owner_constraints.c.id == constraints_id,
                ),
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        return _row_to_constraints(row, b["default_constraints_id"], b["financial_revision"])

    @staticmethod
    def create_version(c, scope, req: ConstraintWrite) -> ConstraintsView:
        b = (
            c.execute(
                text("SELECT financial_revision, version FROM business WHERE id=:b FOR UPDATE"),
                {"b": scope.business_id},
            )
            .mappings()
            .one_or_none()
        )
        if not b:
            raise ApplicationError(404, "NOT_FOUND")
        if b["financial_revision"] != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        cid = uuid4()
        max_v = c.execute(
            text("SELECT COALESCE(MAX(version), 0) + 1 FROM owner_constraints WHERE business_id=:b"),
            {"b": scope.business_id},
        ).scalar_one()
        c.execute(
            text(
                """INSERT INTO owner_constraints (
                    id, business_id, version, safety_reserve_minor,
                    max_customer_concentration_bps, min_order_profit_minor, max_financing_cost_minor,
                    max_financing_cost_bps, target_scenario, priorities, close_call_bps,
                    max_deposit_concession_bps, deposit_lead_days, downside_order_delay_days,
                    downside_ar_delay_days, downside_cost_overrun_bps, downside_deposit_follows_delay,
                    severe_order_delay_days, severe_ar_delay_days, severe_cost_overrun_bps,
                    severe_deposit_follows_delay, max_supplier_extension_days, max_negotiation_rounds,
                    strategy_space, created_by, downside_order_receipt_haircut_bps, severe_order_receipt_haircut_bps
                ) VALUES (
                    :id, :b, :v, :reserve, :max_conc, :min_profit, :max_fin_minor,
                    :max_fin_bps, :target_sc, :priorities, :close_call, :max_dep_conc,
                    :dep_lead, :down_delay, :down_ar, :down_cost, :down_dep, :sev_delay,
                    :sev_ar, :sev_cost, :sev_dep, :max_ext, :max_rounds, CAST(:strat AS jsonb), :actor, :down_haircut, :sev_haircut
                )"""
            ),
            {
                "id": cid,
                "b": scope.business_id,
                "v": max_v,
                "reserve": int(req.reserve_minor),
                "max_conc": req.owner.max_customer_concentration_bps,
                "min_profit": int(req.owner.min_order_profit_minor),
                "max_fin_minor": int(req.owner.max_financing_cost_minor)
                if req.owner.max_financing_cost_minor is not None
                else None,
                "max_fin_bps": req.owner.max_financing_cost_bps,
                "target_sc": req.owner.target_scenario,
                "priorities": req.owner.priorities,
                "close_call": req.owner.close_call_bps,
                "max_dep_conc": req.owner.max_deposit_concession_bps,
                "dep_lead": req.strategy_space.deposit_lead_days,
                "down_haircut": req.scenarios.downside.order_receipt_haircut_bps,
                "sev_haircut": req.scenarios.severe.order_receipt_haircut_bps,
                "down_delay": req.scenarios.downside.order_receipt_delay_days,
                "down_ar": req.scenarios.downside.ar_delay_days,
                "down_cost": req.scenarios.downside.cost_overrun_bps,
                "down_dep": req.scenarios.downside.deposit_follows_delay,
                "sev_delay": req.scenarios.severe.order_receipt_delay_days,
                "sev_ar": req.scenarios.severe.ar_delay_days,
                "sev_cost": req.scenarios.severe.cost_overrun_bps,
                "sev_dep": req.scenarios.severe.deposit_follows_delay,
                "max_ext": req.owner.max_supplier_extension_days,
                "max_rounds": req.owner.max_negotiation_rounds,
                "strat": json.dumps(req.strategy_space.model_dump(mode="json")),
                "actor": scope.user_id,
            },
        )
        if req.make_default:
            c.execute(
                text(
                    "UPDATE business SET default_constraints_id = :cid, financial_revision = financial_revision + 1, version = version + 1 WHERE id = :b"
                ),
                {"cid": cid, "b": scope.business_id},
            )
        else:
            c.execute(
                text("UPDATE business SET financial_revision = financial_revision + 1 WHERE id = :b"),
                {"b": scope.business_id},
            )
        append_audit(c, scope, "create_constraints", payload={"constraints_id": str(cid), "version": max_v})
        return ConstraintsRepository.get_constraints(c, scope.business_id, cid)


class CustomerRepository:
    @staticmethod
    def list_customers(
        c, business_id: UUID, limit: int = 50, offset: int = 0, *, cursor=None, cursors=None, scope=None
    ) -> Page[CustomerView]:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": business_id}
        ).scalar_one()
        rows, continuation = collection_page(
            c, select(customer).where(customer.c.business_id == business_id), customer, business_id, customer.c.created_at, limit, offset,
            cursor=cursor, cursors=cursors, scope=scope, filters=None)
        items = [
            CustomerView(
                id=r["id"],
                version=r["version"],
                financial_revision=b,
                customer=CustomerInput(
                    name=r["name"],
                    known_domains=r["known_domains"] or [],
                    red_flags=r["red_flags"] or [],
                ),
                archived_at=r["archived_at"],
            )
            for r in rows
        ]
        return Page(items=items, next_cursor=continuation)

    @staticmethod
    def create_customer(c, scope, req: CustomerCreate) -> CustomerView:
        b = (
            c.execute(
                text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
                {"b": scope.business_id},
            )
            .mappings()
            .one()
        )
        if b["financial_revision"] != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        cid = uuid4()
        c.execute(
            text(
                "INSERT INTO customer (id, business_id, name, known_domains, red_flags, version, created_at) VALUES (:id, :b, :name, :kd, :rf, 1, clock_timestamp())"
            ),
            {
                "id": cid,
                "b": scope.business_id,
                "name": req.customer.name,
                "kd": req.customer.known_domains,
                "rf": req.customer.red_flags,
            },
        )
        append_audit(c, scope, "create_customer", payload={"customer_id": str(cid)})
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return CustomerView(
            id=cid,
            version=1,
            financial_revision=updated_rev,
            customer=req.customer,
            archived_at=None,
        )

    @staticmethod
    def update_customer(c, scope, customer_id: UUID, req: CustomerWrite) -> CustomerView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        row = (
            c.execute(
                text("SELECT * FROM customer WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": customer_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        if row["version"] != req.expected_version:
            raise ApplicationError(409, "STALE_VERSION")
        c.execute(
            text(
                "UPDATE customer SET name=:name, known_domains=:kd, red_flags=:rf WHERE id=:id AND business_id=:b"
            ),
            {
                "name": req.customer.name,
                "kd": req.customer.known_domains,
                "rf": req.customer.red_flags,
                "id": customer_id,
                "b": scope.business_id,
            },
        )
        append_audit(c, scope, "update_customer", payload={"customer_id": str(customer_id)})
        updated = (
            c.execute(
                text("SELECT * FROM customer WHERE business_id=:b AND id=:id"),
                {"b": scope.business_id, "id": customer_id},
            )
            .mappings()
            .one()
        )
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return CustomerView(
            id=customer_id,
            version=updated["version"],
            financial_revision=updated_rev,
            customer=req.customer,
            archived_at=updated["archived_at"],
        )

    @staticmethod
    def archive_customer(c, scope, customer_id: UUID, reason: RevisionReason) -> CustomerView:
        row = (
            c.execute(
                text("SELECT * FROM customer WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": customer_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        _check_mutation_versions(c, scope, row, reason)
        c.execute(
            text("UPDATE customer SET archived_at=clock_timestamp() WHERE id=:id AND business_id=:b"),
            {"id": customer_id, "b": scope.business_id},
        )
        append_audit(c, scope, "archive_customer", payload={"customer_id": str(customer_id), "reason": reason.reason})
        updated = (
            c.execute(
                text("SELECT * FROM customer WHERE business_id=:b AND id=:id"),
                {"b": scope.business_id, "id": customer_id},
            )
            .mappings()
            .one()
        )
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return CustomerView(
            id=customer_id,
            version=updated["version"],
            financial_revision=b,
            customer=CustomerInput(
                name=updated["name"],
                known_domains=updated["known_domains"] or [],
                red_flags=updated["red_flags"] or [],
            ),
            archived_at=updated["archived_at"],
        )


class PayeeRepository:
    @staticmethod
    def list_payees(
        c, business_id: UUID, limit: int = 50, offset: int = 0, *, cursor=None, cursors=None, scope=None
    ) -> Page[PayeeView]:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": business_id}
        ).scalar_one()
        rows, continuation = collection_page(
            c, select(payee).where(payee.c.business_id == business_id), payee, business_id, payee.c.created_at, limit, offset,
            cursor=cursor, cursors=cursors, scope=scope, filters=None)
        items = [
            PayeeView(
                id=r["id"],
                version=r["version"],
                financial_revision=b,
                payee=PayeeInput(
                    name=r["name"],
                    kind=r["kind"],
                    category=r["category"],
                    terms_days=r["terms_days"],
                    terms_note=r["terms_note"],
                    delay_tolerance_note=r["delay_tolerance_note"],
                    risk_rating=r["risk_rating"],
                    known_domains=r["known_domains"] or [],
                ),
                archived_at=r["archived_at"],
            )
            for r in rows
        ]
        return Page(items=items, next_cursor=continuation)

    @staticmethod
    def create_payee(c, scope, req: PayeeCreate) -> PayeeView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        pid = uuid4()
        c.execute(
            text(
                """INSERT INTO payee (
                    id, business_id, name, kind, category, terms_days, terms_note,
                    delay_tolerance_note, risk_rating, known_domains, version, created_at
                ) VALUES (
                    :id, :b, :name, :kind, :cat, :days, :tnote, :dnote, :rr, :kd, 1, clock_timestamp()
                )"""
            ),
            {
                "id": pid,
                "b": scope.business_id,
                "name": req.payee.name,
                "kind": req.payee.kind,
                "cat": req.payee.category,
                "days": req.payee.terms_days,
                "tnote": req.payee.terms_note,
                "dnote": req.payee.delay_tolerance_note,
                "rr": req.payee.risk_rating,
                "kd": req.payee.known_domains,
            },
        )
        append_audit(c, scope, "create_payee", payload={"payee_id": str(pid)})
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return PayeeView(
            id=pid,
            version=1,
            financial_revision=updated_rev,
            payee=req.payee,
            archived_at=None,
        )

    @staticmethod
    def update_payee(c, scope, payee_id: UUID, req: PayeeWrite) -> PayeeView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        row = (
            c.execute(
                text("SELECT * FROM payee WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": payee_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        if row["version"] != req.expected_version:
            raise ApplicationError(409, "STALE_VERSION")
        c.execute(
            text(
                """UPDATE payee SET
                    name=:name, kind=:kind, category=:cat, terms_days=:days, terms_note=:tnote,
                    delay_tolerance_note=:dnote, risk_rating=:rr, known_domains=:kd
                WHERE id=:id AND business_id=:b"""
            ),
            {
                "name": req.payee.name,
                "kind": req.payee.kind,
                "cat": req.payee.category,
                "days": req.payee.terms_days,
                "tnote": req.payee.terms_note,
                "dnote": req.payee.delay_tolerance_note,
                "rr": req.payee.risk_rating,
                "kd": req.payee.known_domains,
                "id": payee_id,
                "b": scope.business_id,
            },
        )
        append_audit(c, scope, "update_payee", payload={"payee_id": str(payee_id)})
        updated = (
            c.execute(
                text("SELECT * FROM payee WHERE business_id=:b AND id=:id"),
                {"b": scope.business_id, "id": payee_id},
            )
            .mappings()
            .one()
        )
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return PayeeView(
            id=payee_id,
            version=updated["version"],
            financial_revision=updated_rev,
            payee=req.payee,
            archived_at=updated["archived_at"],
        )

    @staticmethod
    def archive_payee(c, scope, payee_id: UUID, reason: RevisionReason) -> PayeeView:
        row = (
            c.execute(
                text("SELECT * FROM payee WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": payee_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        _check_mutation_versions(c, scope, row, reason)
        c.execute(
            text("UPDATE payee SET archived_at=clock_timestamp() WHERE id=:id AND business_id=:b"),
            {"id": payee_id, "b": scope.business_id},
        )
        append_audit(c, scope, "archive_payee", payload={"payee_id": str(payee_id), "reason": reason.reason})
        updated = (
            c.execute(
                text("SELECT * FROM payee WHERE business_id=:b AND id=:id"),
                {"b": scope.business_id, "id": payee_id},
            )
            .mappings()
            .one()
        )
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return PayeeView(
            id=payee_id,
            version=updated["version"],
            financial_revision=b,
            payee=PayeeInput(
                name=updated["name"],
                kind=updated["kind"],
                category=updated["category"],
                terms_days=updated["terms_days"],
                terms_note=updated["terms_note"],
                delay_tolerance_note=updated["delay_tolerance_note"],
                risk_rating=updated["risk_rating"],
                known_domains=updated["known_domains"] or [],
            ),
            archived_at=updated["archived_at"],
        )


def _row_to_offer(row, fin_rev: int) -> OfferView:
    is_term_loan = row["kind"] == "term_loan"
    closed = row["status"] == "closed"
    complete = is_term_loan and all(
        row[key] is not None
        for key in (
            "interest_method", "interest_bps", "fee_bps", "fee_flat_minor", "fee_at",
            "lead_days", "min_minor", "max_minor", "step_minor", "term_days",
            "available_from", "valid_until", "lender_payee_id", "lender_payee_version",
        )
    ) and bool(row["evidence"])
    return OfferView(
        id=row["id"],
        version=row["version"],
        name=row["name"],
        kind=row["kind"],
        status=row["status"],
        terms=TermLoan(
            name=row["name"],
            kind="term_loan",
            interest_method=row["interest_method"] or "fixed_term",
            interest_bps=row["interest_bps"],
            fee_bps=row["fee_bps"],
            fee_flat_minor=str(row["fee_flat_minor"]),
            fee_at=row["fee_at"],
            lead_days=row["lead_days"],
            min_minor=str(row["min_minor"]),
            max_minor=str(row["max_minor"]),
            step_minor=str(row["step_minor"]),
            term_days=row["term_days"],
            available_from=row["available_from"],
            valid_until=row["valid_until"],
            status=row["status"] if row["status"] in ("active", "pre_approved") else "active",
            payee_id=row["lender_payee_id"],
            payee_version=row["lender_payee_version"],
            account_id=row["lender_account_id"],
            account_version=row["lender_account_version"],
            evidence=row["evidence"] or [],
            offer_id=row["id"],
            version=row["version"],
        ) if complete else None,
        # A closed (archived) offer is retained as evidence but is never offered to the engine.
        supported=complete and not closed,
        unavailable_reason=None if complete and not closed else (
            "Offer is closed."
            if closed
            else "Offer is incomplete or lacks lender, account, date, or evidence provenance."
            if is_term_loan
            else "Only fixed term loans are currently supported by the calculation engine"
        ),
        financial_revision=fin_rev,
        archived_at=datetime.now(UTC) if row["status"] == "closed" else None,
    )


def _validate_offer_sources(c, business_id, terms):
    lender = c.execute(text("SELECT version FROM payee WHERE business_id=:b AND id=:id AND archived_at IS NULL"), {"b": business_id, "id": terms.payee_id}).scalar_one_or_none()
    if lender != terms.payee_version:
        raise ApplicationError(409, "STALE_LENDER_REFERENCE")
    if terms.account_id is not None:
        account = c.execute(text("SELECT version FROM payee_bank_account WHERE business_id=:b AND payee_id=:p AND id=:id"), {"b": business_id, "p": terms.payee_id, "id": terms.account_id}).scalar_one_or_none()
        if account != terms.account_version:
            raise ApplicationError(409, "STALE_ACCOUNT_REFERENCE")


class OfferRepository:
    @staticmethod
    def list_offers(
        c, business_id: UUID, limit: int = 50, offset: int = 0, *, cursor=None, cursors=None, scope=None
    ) -> Page[OfferView]:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": business_id}
        ).scalar_one()
        rows, continuation = collection_page(
            c, select(financing_offer).where(financing_offer.c.business_id == business_id), financing_offer, business_id, financing_offer.c.created_at, limit, offset,
            cursor=cursor, cursors=cursors, scope=scope, filters=None)
        items = [_row_to_offer(r, b) for r in rows]
        return Page(items=items, next_cursor=continuation)

    @staticmethod
    def create_offer(c, scope, req: OfferCreate) -> OfferView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        oid = uuid4()
        terms = req.terms
        _validate_offer_sources(c, scope.business_id, terms)
        c.execute(
            text(
                """INSERT INTO financing_offer (
                    id, business_id, name, kind, interest_bps, fee_bps, fee_flat_minor,
                    fee_at, lead_days, min_minor, max_minor, step_minor, term_days,
                    available_from, valid_until, interest_method, status, source, version, created_at,
                    lender_payee_id, lender_payee_version, lender_account_id, lender_account_version, evidence
                ) VALUES (
                    :id, :b, :name, :kind, :int_bps, :fee_bps, :fee_flat, :fee_at,
                    :lead, :min, :max, :step, :term, :afrom, :vuntil, :imethod,
                    :status, 'owner_entered', 1, clock_timestamp(), :payee, :payee_version,
                    :account, :account_version, CAST(:evidence AS jsonb)
                )"""
            ),
            {
                "id": oid,
                "b": scope.business_id,
                "name": terms.name,
                "kind": terms.kind,
                "int_bps": terms.interest_bps,
                "fee_bps": terms.fee_bps,
                "fee_flat": int(terms.fee_flat_minor),
                "fee_at": terms.fee_at,
                "lead": terms.lead_days,
                "min": int(terms.min_minor),
                "max": int(terms.max_minor),
                "step": int(terms.step_minor),
                "term": terms.term_days,
                "afrom": terms.available_from,
                "vuntil": terms.valid_until,
                "imethod": terms.interest_method,
                "status": "active" if terms.status in ("active", "pre_approved") else "active",
                "payee": terms.payee_id,
                "payee_version": terms.payee_version,
                "account": terms.account_id,
                "account_version": terms.account_version,
                "evidence": json.dumps([e.model_dump(mode="json") for e in terms.evidence]),
            },
        )
        append_audit(c, scope, "create_offer", payload={"offer_id": str(oid)})
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        row = (
            c.execute(
                select(financing_offer).where(financing_offer.c.id == oid),
            )
            .mappings()
            .one()
        )
        return _row_to_offer(row, updated_rev)

    @staticmethod
    def update_offer(c, scope, offer_id: UUID, req: OfferWrite) -> OfferView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        row = (
            c.execute(
                text("SELECT * FROM financing_offer WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": offer_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        if row["version"] != req.expected_version:
            raise ApplicationError(409, "STALE_VERSION")
        terms = req.terms
        _validate_offer_sources(c, scope.business_id, terms)
        c.execute(
            text(
                """UPDATE financing_offer SET
                    name=:name, interest_bps=:int_bps, fee_bps=:fee_bps, fee_flat_minor=:fee_flat,
                    fee_at=:fee_at, lead_days=:lead, min_minor=:min, max_minor=:max, step_minor=:step,
                    term_days=:term, available_from=:afrom, valid_until=:vuntil, interest_method=:imethod,
                    lender_payee_id=:payee, lender_payee_version=:payee_version,
                    lender_account_id=:account, lender_account_version=:account_version,
                    evidence=CAST(:evidence AS jsonb)
                WHERE id=:id AND business_id=:b"""
            ),
            {
                "name": terms.name,
                "int_bps": terms.interest_bps,
                "fee_bps": terms.fee_bps,
                "fee_flat": int(terms.fee_flat_minor),
                "fee_at": terms.fee_at,
                "lead": terms.lead_days,
                "min": int(terms.min_minor),
                "max": int(terms.max_minor),
                "step": int(terms.step_minor),
                "term": terms.term_days,
                "afrom": terms.available_from,
                "vuntil": terms.valid_until,
                "imethod": terms.interest_method,
                "payee": terms.payee_id,
                "payee_version": terms.payee_version,
                "account": terms.account_id,
                "account_version": terms.account_version,
                "evidence": json.dumps([item.model_dump(mode="json") for item in terms.evidence]),
                "id": offer_id,
                "b": scope.business_id,
            },
        )
        append_audit(c, scope, "update_offer", payload={"offer_id": str(offer_id)})
        updated = (
            c.execute(
                select(financing_offer).where(financing_offer.c.id == offer_id),
            )
            .mappings()
            .one()
        )
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_offer(updated, updated_rev)

    @staticmethod
    def archive_offer(c, scope, offer_id: UUID, reason: RevisionReason) -> OfferView:
        row = (
            c.execute(
                text("SELECT * FROM financing_offer WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": offer_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        _check_mutation_versions(c, scope, row, reason)
        c.execute(
            text("UPDATE financing_offer SET status='closed' WHERE id=:id AND business_id=:b"),
            {"id": offer_id, "b": scope.business_id},
        )
        append_audit(c, scope, "archive_offer", payload={"offer_id": str(offer_id), "reason": reason.reason})
        updated = (
            c.execute(
                select(financing_offer).where(financing_offer.c.id == offer_id),
            )
            .mappings()
            .one()
        )
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_offer(updated, b)


def _row_to_cash_event(r, fin_rev: int) -> CashEventView:
    ev = CashEventInput(
        deal_id=r["deal_id"],
        event_date=r["event_date"],
        amount_minor=str(r["amount_minor"]),
        direction=r["direction"],
        kind=r["kind"],
        certainty=r["certainty"],
        description=r["description"],
        invoice_ref=r["invoice_ref"],
        is_deferrable=r["is_deferrable"],
        incremental=r["incremental"],
        customer_id=r["customer_id"],
        payee_id=r["payee_id"],
        evidence=Evidence.model_validate(r["evidence"][0]) if r.get("evidence") else Evidence(
            document_id=None, content_hash=None, candidate_id=None, confirmed_field_id=None,
            source_role="baseline" if r["deal_id"] is None else "supplier_cost_quote", page=None,
            quote=None, manual_attestation="Legacy owner-entered event", override_reason=None,
        ),
    )
    return CashEventView(
        id=str(r["id"]),
        version=r["version"],
        financial_revision=fin_rev,
        event=ev,
        voided_at=r["voided_at"],
    )


def _validate_manual_cash_event(event):
    if event.deal_id is not None:
        if event.direction != "out" or event.kind not in {"supplier_payment", "labour", "freight", "subcontract", "existing_inventory"}:
            raise ApplicationError(422, "UNSUPPORTED_DEAL_CASH_EVENT")
        if not event.incremental and not event.description:
            raise ApplicationError(422, "NONINCREMENTAL_REASON_REQUIRED")
        if event.kind == "existing_inventory" and event.incremental:
            raise ApplicationError(422, "EXISTING_INVENTORY_NOT_INCREMENTAL")


class CashEventRepository:
    @staticmethod
    def list_events(
        c, business_id: UUID, deal_id: UUID | None = None, limit: int = 50, offset: int = 0, *, cursor=None, cursors=None, scope=None
    ) -> Page[CashEventView]:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": business_id}
        ).scalar_one()
        query = select(cash_event).where(cash_event.c.business_id == business_id)
        if deal_id is not None:
            # A committed order's projected baseline events are not editable order costs.
            query = query.where(cash_event.c.deal_id == deal_id).where(
                text(
                    "NOT EXISTS(SELECT FROM commitment_projection cp WHERE cp.business_id=cash_event.business_id "
                    "AND cp.cash_event_id=cash_event.id)"
                )
            )
        else:
            query = query.where(cash_event.c.deal_id.is_(None))
        rows, continuation = collection_page(
            c, query, cash_event, business_id, cash_event.c.event_date, limit, offset,
            cursor=cursor, cursors=cursors, scope=scope, filters={"deal_id": deal_id})
        items = [_row_to_cash_event(r, b) for r in rows]
        return Page(items=items, next_cursor=continuation)

    @staticmethod
    def create_event(c, scope, req: CashEventCreate) -> CashEventView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        ev = req.event
        _validate_manual_cash_event(ev)
        duplicate_rows = []
        if ev.deal_id is None:
            duplicate_rows = baseline_duplicates.matches(c, scope.business_id, ev)
            baseline_duplicates.require_review(duplicate_rows, req.duplicate_review)
        elif req.duplicate_review is not None:
            raise ApplicationError(422, "UNEXPECTED_DUPLICATE_REVIEW")
        doc_id = ev.evidence.document_id
        quote = ev.evidence.quote
        eid = c.execute(
            text(
                """INSERT INTO cash_event (
                    business_id, deal_id, event_date, amount_minor, direction, kind, certainty,
                    description, invoice_ref, is_deferrable, incremental, customer_id, payee_id,
                    source_document_id, source_quote, version, created_at, evidence
                ) VALUES (
                    :b, :d, :edate, :amt, :dir, :kind, :cert, :desc, :iref, :defer, :incr,
                    :cid, :pid, :doc, :quote, 1, clock_timestamp(), CAST(:evidence AS jsonb)
                ) RETURNING id"""
            ),
            {
                "b": scope.business_id,
                "d": ev.deal_id,
                "edate": ev.event_date,
                "amt": int(ev.amount_minor),
                "dir": ev.direction,
                "kind": ev.kind,
                "cert": ev.certainty,
                "desc": ev.description,
                "iref": ev.invoice_ref,
                "defer": ev.is_deferrable,
                "incr": ev.incremental,
                "cid": ev.customer_id,
                "pid": ev.payee_id,
                "doc": doc_id,
                "quote": quote,
                "evidence": json.dumps([ev.evidence.model_dump(mode="json")]),
            },
        ).scalar_one()
        baseline_duplicates.record_review(c, scope, eid, 1, duplicate_rows, req.duplicate_review)
        append_audit(c, scope, "create_cash_event", payload={"event_id": eid})
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        row = c.execute(select(cash_event).where(cash_event.c.id == eid)).mappings().one()
        return _row_to_cash_event(row, updated_rev)

    @staticmethod
    def update_event(c, scope, event_id: int, req: CashEventWrite) -> CashEventView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        row = (
            c.execute(
                text("SELECT * FROM cash_event WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": event_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        if row["version"] != req.expected_version:
            raise ApplicationError(409, "STALE_VERSION")
        ev = req.event
        if ev.deal_id != row["deal_id"]:
            raise ApplicationError(422, "IMMUTABLE_EVENT_SCOPE")
        _validate_manual_cash_event(ev)
        duplicate_rows = []
        if ev.deal_id is None and row["voided_at"] is None:
            duplicate_rows = baseline_duplicates.matches(c, scope.business_id, ev, exclude_id=event_id)
            baseline_duplicates.require_review(duplicate_rows, req.duplicate_review)
        elif req.duplicate_review is not None:
            raise ApplicationError(422, "UNEXPECTED_DUPLICATE_REVIEW")
        doc_id = ev.evidence.document_id
        quote = ev.evidence.quote
        c.execute(
            text(
                """UPDATE cash_event SET
                    event_date=:edate, amount_minor=:amt, direction=:dir, kind=:kind, certainty=:cert,
                    description=:desc, invoice_ref=:iref, is_deferrable=:defer, incremental=:incr,
                    customer_id=:cid, payee_id=:pid, source_document_id=:doc, source_quote=:quote,
                    evidence=CAST(:evidence AS jsonb)
                WHERE id=:id AND business_id=:b"""
            ),
            {
                "edate": ev.event_date,
                "amt": int(ev.amount_minor),
                "dir": ev.direction,
                "kind": ev.kind,
                "cert": ev.certainty,
                "desc": ev.description,
                "iref": ev.invoice_ref,
                "defer": ev.is_deferrable,
                "incr": ev.incremental,
                "cid": ev.customer_id,
                "pid": ev.payee_id,
                "doc": doc_id,
                "quote": quote,
                "evidence": json.dumps([ev.evidence.model_dump(mode="json")]),
                "id": event_id,
                "b": scope.business_id,
            },
        )
        baseline_duplicates.record_review(c, scope, event_id, row["version"] + 1,
                                          duplicate_rows, req.duplicate_review)
        append_audit(c, scope, "update_cash_event", payload={"event_id": event_id})
        updated = c.execute(select(cash_event).where(cash_event.c.id == event_id)).mappings().one()
        updated_rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_cash_event(updated, updated_rev)

    @staticmethod
    def duplicate_candidates(c, scope, event_id: int) -> CashEventDuplicates:
        row = c.execute(text("SELECT * FROM cash_event WHERE business_id=:b AND id=:id AND voided_at IS NULL AND "
                             + baseline_duplicates.EFFECTIVE.format(alias="cash_event")),
                        {"b": scope.business_id, "id": event_id}).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        revision = c.execute(text("SELECT financial_revision FROM business WHERE id=:b"),
                             {"b": scope.business_id}).scalar_one()
        rows = baseline_duplicates.matches(c, scope.business_id, row, exclude_id=event_id,
                                           unresolved=True, event_version=row["version"])

        def candidate(r):
            return CashEventDuplicateMatch(**{
                key: str(r[key]) if key in {"id", "amount_minor"} else r[key]
                for key in CashEventDuplicateMatch.model_fields})

        return CashEventDuplicates(event_id=str(event_id), version=row["version"],
                                   financial_revision=revision, event=candidate(row),
                                   matching_events=[candidate(r) for r in rows])

    @staticmethod
    def review_duplicates(c, scope, event_id, req) -> CashEventDuplicates:
        revision = c.execute(text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
                             {"b": scope.business_id}).scalar_one()
        if revision != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        current = CashEventRepository.duplicate_candidates(c, scope, event_id)
        if current.version != req.expected_version:
            raise ApplicationError(409, "STALE_VERSION")
        rows = [r.model_dump() | {"id": int(r.id)} for r in current.matching_events]
        baseline_duplicates.require_review(rows, req.duplicate_review)
        baseline_duplicates.record_review(c, scope, event_id, current.version, rows, req.duplicate_review)
        append_audit(c, scope, "review_baseline_duplicates", payload={
            "event_id": event_id, "matching_event_ids": req.duplicate_review.matching_event_ids})
        return CashEventRepository.duplicate_candidates(c, scope, event_id)

    @staticmethod
    def void_event(c, scope, event_id: int, reason: RevisionReason) -> CashEventView:
        row = (
            c.execute(
                text("SELECT * FROM cash_event WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": event_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        _check_mutation_versions(c, scope, row, reason)
        c.execute(
            text("UPDATE cash_event SET voided_at=clock_timestamp() WHERE id=:id AND business_id=:b"),
            {"id": event_id, "b": scope.business_id},
        )
        append_audit(c, scope, "void_cash_event", payload={"event_id": event_id, "reason": reason.reason})
        updated = c.execute(select(cash_event).where(cash_event.c.id == event_id)).mappings().one()
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_cash_event(updated, b)

    @staticmethod
    def get_cash_flow_series(c, business_id: UUID) -> Series:
        b = (
            c.execute(
                text("SELECT currency, baseline_settings, default_constraints_id FROM business WHERE id=:b"),
                {"b": business_id},
            )
            .mappings()
            .one_or_none()
        )
        if not b:
            raise ApplicationError(404, "NOT_FOUND")
        bs = b["baseline_settings"] or {}
        if not bs.get("opening_date") or "opening_cash_minor" not in bs:
            raise ApplicationError(409, "BASELINE_NOT_CONFIGURED")
        start_date = date.fromisoformat(bs["opening_date"])
        running_cash = int(bs.get("opening_cash_minor", 0))
        reserve = 0
        if b["default_constraints_id"]:
            cid = b["default_constraints_id"]
            res = c.execute(
                text("SELECT safety_reserve_minor FROM owner_constraints WHERE id=:cid"),
                {"cid": cid},
            ).scalar_one_or_none()
            if res is not None:
                reserve = res
        events = (
            c.execute(
                text(
                    "SELECT event_date, amount_minor, direction FROM cash_event ce WHERE business_id=:b AND voided_at IS NULL "
                    "AND (deal_id IS NULL OR EXISTS(SELECT FROM commitment_projection cp WHERE cp.business_id=ce.business_id AND cp.cash_event_id=ce.id)) "
                    "ORDER BY event_date ASC,id ASC"
                ),
                {"b": business_id},
            )
            .mappings()
            .all()
        )
        points = [
            SeriesPoint(
                date=start_date,
                baseline_trough_minor=str(running_cash),
                baseline_close_minor=str(running_cash),
                candidate_trough_minor=str(running_cash),
                candidate_close_minor=str(running_cash),
                reserve_minor=str(reserve),
                effective_floor_minor=str(reserve),
            )
        ]
        for ev in events:
            amt = ev["amount_minor"] if ev["direction"] == "in" else -ev["amount_minor"]
            running_cash += amt
            points.append(
                SeriesPoint(
                    date=ev["event_date"],
                    baseline_trough_minor=str(running_cash),
                    baseline_close_minor=str(running_cash),
                    candidate_trough_minor=str(running_cash),
                    candidate_close_minor=str(running_cash),
                    reserve_minor=str(reserve),
                    effective_floor_minor=str(reserve),
                )
            )
        return Series(
            evaluation_id=None,
            option_key="baseline",
            scenario="base",
            currency=b["currency"],
            exponent=2,
            points=points,
        )


def _row_to_deal(c, r, fin_rev: int) -> DealView:
    deal_id = r["id"]
    business_id = r["business_id"]
    # Check live evaluation
    live_eval = (
        c.execute(
            text(
                "SELECT id, input_version, financial_revision FROM evaluation WHERE business_id=:b AND deal_id=:d AND superseded_at IS NULL"
            ),
            {"b": business_id, "d": deal_id},
        )
        .mappings()
        .one_or_none()
    )
    is_stale = False
    live_id = None
    if live_eval:
        live_id = live_eval["id"]
        is_stale = (live_eval["input_version"] != r["input_version"]) or (
            live_eval["financial_revision"] != fin_rev
        )
    # Check flags
    flags = (
        c.execute(
            text(
                "SELECT id, code, field, message, blocking FROM deal_flag "
                "WHERE business_id=:b AND deal_id=:d AND resolved_at IS NULL ORDER BY id"
            ),
            {"b": business_id, "d": deal_id},
        )
        .mappings()
        .all()
    )
    findings = [
        Finding(
            code=f["code"],
            field=f["field"] or "deal",
            message=f["message"],
            blocking=f["blocking"],
            resolution="correct_input",
            flag_id=str(f["id"]),
        )
        for f in flags
    ]
    # Allowed actions
    st = r["status"]
    has_blocking = any(f["blocking"] for f in flags)
    actions = []
    if st == "ingesting":
        actions = ["edit", "review", "close"]
    elif st == "awaiting_confirm":
        actions = ["edit", "review", "close"]
        if not has_blocking:
            actions.append("confirm")
            # If snapshot exists and matches, evaluation is admitted
            has_snap = c.execute(
                text("SELECT 1 FROM input_snapshot WHERE business_id=:b AND deal_id=:d AND input_version=:iv AND financial_revision=:fr LIMIT 1"),
                {"b": business_id, "d": deal_id, "iv": r["input_version"], "fr": fin_rev},
            ).scalar_one_or_none()
            if has_snap:
                actions.append("evaluate")
    elif st == "computing":
        actions = ["poll", "close"]
    elif st == "awaiting_approval":
        actions = ["inspect_result", "reopen_for_review", "hold", "close"]
    elif st == "awaiting_reply":
        actions = ["reopen_for_review", "hold", "close"]
    elif st in ("committed", "closed"):
        actions = ["export"]
    elif st == "failed":
        actions = ["reopen_for_review", "close"]
    # Get costs
    cost_rows = (
        c.execute(
            text(
                "SELECT * FROM cash_event ce WHERE business_id=:b AND deal_id=:d AND voided_at IS NULL "
                "AND NOT EXISTS(SELECT FROM commitment_projection cp WHERE cp.business_id=ce.business_id AND cp.cash_event_id=ce.id) "
                "ORDER BY event_date ASC,id ASC"
            ),
            {"b": business_id, "d": deal_id},
        )
        .mappings()
        .all()
    )
    if any(not row["evidence"] for row in cost_rows):
        raise ApplicationError(409, "COST_EVIDENCE_MISSING", "Review and provide evidence for the saved costs.")
    costs = [
        CostInput(
            event_id=str(cr["id"]),
            cost_key=cr["cost_key"] or f"cost-{cr['id']}",
            event_date=cr["event_date"],
            amount_minor=str(cr["amount_minor"]),
            kind=cr["kind"],
            is_deferrable=cr["is_deferrable"],
            incremental=cr["incremental"],
            nonincremental_reason=None if cr["incremental"] else cr["description"],
            invoice_ref=cr["invoice_ref"],
            payee_id=cr["payee_id"],
            original_obligation_id=cr["original_obligation_id"] or f"obl-{cr['id']}",
            evidence=[Evidence.model_validate(item) for item in cr["evidence"]],
        )
        for cr in cost_rows
    ]
    inputs = DraftInputs(
        opening_cash_minor=str(r["opening_cash_minor"]) if r["opening_cash_minor"] is not None else None,
        reserve_minor=str(r["reserve_minor"]) if r["reserve_minor"] is not None else None,
        order_value_minor=str(r["order_value_minor"]) if r["order_value_minor"] is not None else None,
        order_date=r["order_date"],
        invoice_date=r["invoice_date"],
        delivery_date=r["delivery_date"],
        payment_basis=r["payment_basis"],
        payment_days=r["payment_days"],
        customer_id=r["customer_id"],
        constraints_id=r["constraints_id"],
        costs=costs,
    )
    return DealView(
        id=deal_id,
        public_ref=r["public_ref"],
        status=st,
        version=r["version"],
        input_version=r["input_version"],
        financial_revision=fin_rev,
        currency=r["currency"],
        exponent=2,
        start_date=r["start_date"],
        opening_cash_minor=str(r["opening_cash_minor"]) if r["opening_cash_minor"] is not None else None,
        order_value_minor=str(r["order_value_minor"]) if r["order_value_minor"] is not None else None,
        inputs=inputs,
        live_evaluation_id=live_id,
        negotiation_round=r["negotiation_round"],
        is_stale=is_stale,
        findings=findings,
        allowed_actions=actions,
    )


class DealRepository:
    @staticmethod
    def list_deals(
        c, business_id: UUID, limit: int = 50, offset: int = 0, *, cursor=None, cursors=None, scope=None
    ) -> Page[DealView]:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": business_id}
        ).scalar_one()
        rows, continuation = collection_page(
            c, select(deal).where(deal.c.business_id == business_id), deal, business_id, deal.c.created_at, limit, offset,
            cursor=cursor, cursors=cursors, scope=scope, filters=None)
        items = [_row_to_deal(c, r, b) for r in rows]
        return Page(items=items, next_cursor=continuation)

    @staticmethod
    def create_deal(c, scope, req: CreateDeal) -> DealView:
        b = (
            c.execute(
                text("SELECT currency, default_constraints_id, financial_revision FROM business WHERE id=:b FOR UPDATE"),
                {"b": scope.business_id},
            )
            .mappings()
            .one()
        )
        did = uuid4()
        pref = req.public_ref
        sdate = req.start_date
        cid = req.constraints_id
        c.execute(
            text(
                """INSERT INTO deal (
                    id, business_id, public_ref, customer_id, status, currency, start_date,
                    constraints_id, version, input_version, created_by, created_at, updated_at
                ) VALUES (
                    :id, :b, :pref, :cust, 'ingesting', :curr, :sdate, :cid, 1, 1, :actor,
                    clock_timestamp(), clock_timestamp()
                )"""
            ),
            {
                "id": did,
                "b": scope.business_id,
                "pref": pref,
                "cust": req.customer_id,
                "curr": b["currency"],
                "sdate": sdate,
                "cid": cid,
                "actor": scope.user_id,
            },
        )
        append_audit(c, scope, "create_deal", deal_id=did, payload={"public_ref": pref})
        row = c.execute(select(deal).where(deal.c.id == did)).mappings().one()
        return _row_to_deal(c, row, b["financial_revision"])

    @staticmethod
    def get_deal(c, business_id: UUID, deal_id: UUID) -> DealView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": business_id}
        ).scalar_one()
        row = (
            c.execute(
                select(deal).where(deal.c.business_id == business_id, deal.c.id == deal_id),
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        return _row_to_deal(c, row, b)

    @staticmethod
    def update_deal(c, scope, deal_id: UUID, req: DealWrite) -> DealView:
        b_row = c.execute(
            text("SELECT financial_revision, baseline_settings FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).mappings().one()
        b = b_row["financial_revision"]
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        row = (
            c.execute(
                text("SELECT * FROM deal WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": deal_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        if row["version"] != req.expected_version:
            raise ApplicationError(409, "STALE_VERSION")
        if row["input_version"] != req.expected_input_version:
            raise ApplicationError(409, "STALE_INPUT_VERSION")
        st = row["status"]
        if st in ("committed", "closed"):
            raise ApplicationError(409, "DEAL_TERMINAL")
        if st == "computing":
            raise ApplicationError(409, "DEAL_COMPUTING")
        # DB-08: If deal inputs are frozen (e.g. awaiting_approval or awaiting_reply),
        # move to awaiting_confirm in first UPDATE, then update inputs in second UPDATE.
        if st in ("awaiting_approval", "awaiting_reply"):
            c.execute(
                text("UPDATE deal SET status='awaiting_confirm' WHERE id=:d AND business_id=:b"),
                {"d": deal_id, "b": scope.business_id},
            )
        inp = req.inputs
        # The browser deliberately does not duplicate the business-level opening
        # balance in every order form. Keep the reviewed baseline on the deal row
        # as the database's post-confirmation state constraint requires it; review
        # still rejects a stale date or an explicit conflicting override.
        baseline = b_row["baseline_settings"] or {}
        effective_opening_cash = (
            int(inp.opening_cash_minor)
            if inp.opening_cash_minor is not None
            else int(baseline["opening_cash_minor"])
            if "opening_cash_minor" in baseline
            else None
        )
        for values in ([cost.cost_key for cost in inp.costs],
                       [cost.original_obligation_id for cost in inp.costs],
                       [cost.event_id for cost in inp.costs if cost.event_id is not None]):
            if len(values) != len(set(values)):
                raise ApplicationError(422, "DUPLICATE_COST_IDENTITY")
        c.execute(
            text(
                """UPDATE deal SET
                    opening_cash_minor=:ocash, reserve_minor=:res, order_value_minor=:oval,
                    order_date=:odate, invoice_date=:idate, delivery_date=:ddate,
                    payment_basis=:pbasis, payment_days=:pdays, customer_id=:cid,
                    constraints_id=:const_id, updated_at=clock_timestamp()
                WHERE id=:d AND business_id=:b"""
            ),
            {
                "ocash": effective_opening_cash,
                "res": int(inp.reserve_minor) if inp.reserve_minor is not None else None,
                "oval": int(inp.order_value_minor) if inp.order_value_minor is not None else None,
                "odate": inp.order_date,
                "idate": inp.invoice_date,
                "ddate": inp.delivery_date,
                "pbasis": inp.payment_basis,
                "pdays": inp.payment_days,
                "cid": inp.customer_id,
                "const_id": inp.constraints_id,
                "d": deal_id,
                "b": scope.business_id,
            },
        )
        # DraftInputs carries the complete current cost list. Omissions void old
        # rows, preserving their history and participating in revision invalidation.
        retained_ids = {int(cost.event_id) for cost in inp.costs if cost.event_id is not None}
        for (event_id,) in c.execute(text("SELECT id FROM cash_event WHERE business_id=:b AND deal_id=:d AND voided_at IS NULL ORDER BY id FOR UPDATE"), {"b": scope.business_id, "d": deal_id}):
            if event_id not in retained_ids:
                c.execute(text("UPDATE cash_event SET voided_at=clock_timestamp() WHERE business_id=:b AND id=:id"), {"b": scope.business_id, "id": event_id})
        if inp.costs:
            for cost in inp.costs:
                if cost.event_id is not None:
                    updated_cost = c.execute(
                        text(
                            """UPDATE cash_event SET
                                event_date=:edate, amount_minor=:amt, kind=:kind, is_deferrable=:defer,
                                incremental=:incr, payee_id=:pid, invoice_ref=:iref,
                                evidence=CAST(:evidence AS jsonb), description=:reason,
                                source_document_id=:doc, source_quote=:quote,
                                cost_key=:cost_key, original_obligation_id=:obligation
                            WHERE id=:eid AND business_id=:b AND deal_id=:d AND voided_at IS NULL"""
                        ),
                        {
                            "edate": cost.event_date,
                            "amt": int(cost.amount_minor),
                            "kind": cost.kind,
                            "defer": cost.is_deferrable,
                            "incr": cost.incremental,
                            "pid": cost.payee_id,
                            "iref": cost.invoice_ref,
                            "evidence": json.dumps([e.model_dump(mode="json") for e in cost.evidence]),
                            "reason": cost.nonincremental_reason,
                            "doc": cost.evidence[0].document_id,
                            "quote": cost.evidence[0].quote,
                            "cost_key": cost.cost_key,
                            "obligation": cost.original_obligation_id,
                            "eid": cost.event_id,
                            "b": scope.business_id,
                            "d": deal_id,
                        },
                    )
                    if updated_cost.rowcount != 1:
                        raise ApplicationError(404, "COST_NOT_FOUND")
                else:
                    doc_id = cost.evidence[0].document_id if cost.evidence else None
                    quote = cost.evidence[0].quote if cost.evidence else None
                    c.execute(
                        text(
                            """INSERT INTO cash_event (
                                business_id, deal_id, event_date, amount_minor, direction, kind,
                                certainty, is_deferrable, incremental, payee_id, invoice_ref,
                                source_document_id, source_quote, version, created_at, evidence, description, cost_key, original_obligation_id
                            ) VALUES (
                                :b, :d, :edate, :amt, 'out', :kind, 'expected', :defer, :incr,
                                :pid, :iref, :doc, :quote, 1, clock_timestamp(), CAST(:evidence AS jsonb), :reason, :cost_key, :obligation
                            )"""
                        ),
                        {
                            "b": scope.business_id,
                            "d": deal_id,
                            "edate": cost.event_date,
                            "amt": int(cost.amount_minor),
                            "kind": cost.kind,
                            "defer": cost.is_deferrable,
                            "incr": cost.incremental,
                            "pid": cost.payee_id,
                            "iref": cost.invoice_ref,
                            "doc": doc_id,
                            "quote": quote,
                            "evidence": json.dumps([e.model_dump(mode="json") for e in cost.evidence]),
                            "reason": cost.nonincremental_reason,
                            "cost_key": cost.cost_key,
                            "obligation": cost.original_obligation_id,
                        },
                    )
        append_audit(c, scope, "update_deal_inputs", deal_id=deal_id)
        updated = c.execute(select(deal).where(deal.c.id == deal_id)).mappings().one()
        b_now = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_deal(c, updated, b_now)

    @staticmethod
    def close_deal(c, scope, deal_id: UUID, reason: ReasonCommand) -> DealView:
        row = (
            c.execute(
                text("SELECT * FROM deal WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": deal_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        _check_mutation_versions(c, scope, row, reason)
        c.execute(
            text("UPDATE deal SET status='closed', closed_at=clock_timestamp() WHERE id=:id AND business_id=:b"),
            {"id": deal_id, "b": scope.business_id},
        )
        append_audit(c, scope, "close_deal", deal_id=deal_id, payload={"reason": reason.reason})
        updated = c.execute(select(deal).where(deal.c.id == deal_id)).mappings().one()
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_deal(c, updated, b)

    @staticmethod
    def reopen_for_review(c, scope, deal_id: UUID, reason: ReasonCommand) -> DealView:
        row = (
            c.execute(
                text("SELECT * FROM deal WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": deal_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        _check_mutation_versions(c, scope, row, reason)
        if row["status"] in ("closed", "committed", "computing"):
            raise ApplicationError(409, "DEAL_STATE_CONFLICT")
        if row["status"] == "failed":
            c.execute(text("UPDATE deal SET status='ingesting' WHERE business_id=:b AND id=:id"), {"b": scope.business_id, "id": deal_id})
        if row["status"] in ("awaiting_approval", "awaiting_reply"):
            c.execute(
                text("UPDATE deal SET status='awaiting_confirm' WHERE id=:id AND business_id=:b"),
                {"id": deal_id, "b": scope.business_id},
            )
        append_audit(c, scope, "reopen_deal", deal_id=deal_id, payload={"reason": reason.reason})
        updated = c.execute(select(deal).where(deal.c.id == deal_id)).mappings().one()
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_deal(c, updated, b)

    @staticmethod
    def hold_deal(c, scope, deal_id: UUID, reason: ReasonCommand) -> DealView:
        row = (
            c.execute(
                text("SELECT * FROM deal WHERE business_id=:b AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "id": deal_id},
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        _check_mutation_versions(c, scope, row, reason)
        if row["status"] in ("closed", "committed"):
            raise ApplicationError(409, "DEAL_TERMINAL")
        c.execute(text("UPDATE deal SET version=version WHERE business_id=:b AND id=:id"), {"b": scope.business_id, "id": deal_id})
        c.execute(
            text(
                """INSERT INTO deal_flag (
                    business_id, deal_id, kind, code, message, blocking, raised_by, raised_at
                ) VALUES (
                    :b, :d, 'validation', 'MANUAL-HOLD', :msg, true, 'owner', clock_timestamp()
                )"""
            ),
            {"b": scope.business_id, "d": deal_id, "msg": reason.reason},
        )
        append_audit(c, scope, "hold_deal", deal_id=deal_id, payload={"reason": reason.reason})
        updated = c.execute(select(deal).where(deal.c.id == deal_id)).mappings().one()
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
        ).scalar_one()
        return _row_to_deal(c, updated, b)

    @staticmethod
    def resolve_flag(c, scope, deal_id: UUID, flag_id: int, req: FlagResolution) -> DealView:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        d = (
            c.execute(
                text("SELECT * FROM deal WHERE business_id=:b AND id=:d FOR UPDATE"),
                {"b": scope.business_id, "d": deal_id},
            )
            .mappings()
            .one_or_none()
        )
        if not d:
            raise ApplicationError(404, "NOT_FOUND")
        if (d["version"], d["input_version"]) != (req.expected_version, req.expected_input_version):
            raise ApplicationError(409, "STALE_VERSION")
        flag = (
            c.execute(
                text("SELECT * FROM deal_flag WHERE business_id=:b AND deal_id=:d AND id=:id FOR UPDATE"),
                {"b": scope.business_id, "d": deal_id, "id": flag_id},
            )
            .mappings()
            .one_or_none()
        )
        if not flag:
            raise ApplicationError(404, "NOT_FOUND")
        audit_extra = {}
        if flag["code"] == "P5-BANK-CHANGE":
            audit_extra = _bank_change_resolution(c, scope, deal_id, flag, req)
        elif req.bank_verification is not None:
            raise ApplicationError(422, "BANK_VERIFICATION_NOT_APPLICABLE")
        c.execute(
            text(
                "UPDATE deal_flag SET resolved_at=clock_timestamp(), resolved_by=:u, resolution_note=:note WHERE id=:id AND business_id=:b AND deal_id=:d"
            ),
            {"id": flag_id, "u": scope.user_id, "note": req.reason, "b": scope.business_id, "d": deal_id},
        )
        c.execute(text("UPDATE deal SET version=version WHERE business_id=:b AND id=:id"), {"b": scope.business_id, "id": deal_id})
        append_audit(c, scope, "resolve_flag", deal_id=deal_id,
                     payload={"flag_id": flag_id, "reason": req.reason} | audit_extra)
        updated = c.execute(select(deal).where(deal.c.id == deal_id)).mappings().one()
        return _row_to_deal(c, updated, b)

    @staticmethod
    def build_review(c, business_id: UUID, deal_id: UUID) -> Review:
        try:
            return DealRepository._build_review(c, business_id, deal_id)
        except (ValidationError, ApplicationError) as exc:
            if isinstance(exc, ApplicationError) and exc.code not in {
                "UNSUPPORTED_EXTENSION_SUBSET", "UNSUPPORTED_EXTENSION_TERMS", "INVALID_FINANCING_GRID"
            }:
                raise
            # Invalid combinations remain reviewable instead of becoming HTTP 500 or
            # silently coercing financial assumptions. Never echo confidential values.
            row = c.execute(text("SELECT d.version,d.input_version,b.financial_revision FROM deal d JOIN business b ON b.id=d.business_id WHERE d.business_id=:b AND d.id=:d"), {"b": business_id, "d": deal_id}).mappings().one_or_none()
            if row is None:
                raise ApplicationError(404, "NOT_FOUND") from None
            return Review(deal_id=deal_id, version=row["version"], input_version=row["input_version"], financial_revision=row["financial_revision"], candidate_snapshot=None, snapshot_hash=None, required_field_ids=[], findings=[Finding(code="INPUT-REVIEW-REQUIRED", field="inputs", message="The recorded dates, financing, evidence or analysis bounds require correction before confirmation.", blocking=True, resolution="correct_input")])

    @staticmethod
    def _build_review(c, business_id: UUID, deal_id: UUID) -> Review:
        b_row = (
            c.execute(
                text("SELECT currency, baseline_settings, financial_revision, default_constraints_id FROM business WHERE id=:b"),
                {"b": business_id},
            )
            .mappings()
            .one_or_none()
        )
        if not b_row:
            raise ApplicationError(404, "NOT_FOUND")
        d_row = (
            c.execute(
                select(deal).where(deal.c.business_id == business_id, deal.c.id == deal_id),
            )
            .mappings()
            .one_or_none()
        )
        if not d_row:
            raise ApplicationError(404, "NOT_FOUND")
        cid = d_row["constraints_id"] or b_row["default_constraints_id"]
        c_row = (
            c.execute(
                select(owner_constraints).where(
                    owner_constraints.c.business_id == business_id,
                    owner_constraints.c.id == cid,
                ),
            )
            .mappings()
            .one_or_none()
        )
        if not c_row:
            raise ApplicationError(404, "CONSTRAINTS_NOT_FOUND")
        flags = (
            c.execute(
                text("SELECT * FROM deal_flag WHERE business_id=:b AND deal_id=:d AND resolved_at IS NULL ORDER BY id"),
                {"b": business_id, "d": deal_id},
            )
            .mappings()
            .all()
        )
        findings = []
        for pair in baseline_duplicates.unresolved_pairs(c, business_id, excluding_deal_id=deal_id):
            findings.append(Finding(
                code="BASELINE_DUPLICATE_UNRESOLVED", field="baseline_events",
                message=f"Baseline events {pair['event_id']} and {pair['matching_event_id']} may describe the same obligation. Void/correct the duplicate or record a distinct-obligation review.",
                blocking=True, resolution="correct_input",
                related_event_ids=[str(pair["event_id"]), str(pair["matching_event_id"])]))
        for f in flags:
            findings.append(
                Finding(
                    code=f["code"],
                    field=f["field"] or "deal",
                    message=f["message"],
                    blocking=f["blocking"],
                    resolution="correct_input",
                    flag_id=str(f["id"]),
                )
            )
        # Check required fields
        if d_row["order_value_minor"] is None:
            findings.append(
                Finding(
                    code="MISSING_ORDER_VALUE",
                    field="order_value_minor",
                    message="Order value is required",
                    blocking=True,
                    resolution="correct_input",
                )
            )
        if d_row["delivery_date"] is None:
            findings.append(
                Finding(
                    code="MISSING_DELIVERY_DATE",
                    field="delivery_date",
                    message="Delivery date is required",
                    blocking=True,
                    resolution="correct_input",
                )
            )
        if d_row["payment_basis"] is None or d_row["payment_days"] is None:
            findings.append(Finding(code="MISSING_PAYMENT_TERMS", field="payment_terms", message="Confirm the payment anchor and payment days.", blocking=True, resolution="correct_input"))
        elif d_row["payment_basis"] == "invoice" and d_row["invoice_date"] is None:
            findings.append(Finding(code="MISSING_INVOICE_DATE", field="invoice_date", message="The selected invoice payment anchor needs an invoice date.", blocking=True, resolution="correct_input"))
        if d_row["payment_basis"] == "order" and d_row["order_date"] is None:
            findings.append(Finding(code="MISSING_ORDER_DATE", field="order_date", message="The selected order payment anchor needs an order date.", blocking=True, resolution="correct_input"))
        if d_row["customer_id"] is None:
            findings.append(
                Finding(
                    code="MISSING_CUSTOMER",
                    field="customer_id",
                    message="Customer is required",
                    blocking=True,
                    resolution="correct_input",
                )
            )
        has_blocking = any(f.blocking for f in findings)
        # Manual values have no extracted_field identity; never fabricate BIGINT evidence IDs.
        required_field_ids = []
        if has_blocking:
            return Review(
                deal_id=deal_id,
                version=d_row["version"],
                input_version=d_row["input_version"],
                financial_revision=b_row["financial_revision"],
                candidate_snapshot=None,
                snapshot_hash=None,
                findings=findings,
                required_field_ids=required_field_ids,
            )
        # Build confirmed candidate snapshot
        bs = b_row["baseline_settings"] or {}
        if "opening_cash_minor" not in bs:
            findings.append(Finding(code="BASELINE-MISSING", field="baseline", message="Configure a dated opening cash balance and evidence before review.", blocking=True, resolution="provide_evidence"))
            return Review(deal_id=deal_id, version=d_row["version"], input_version=d_row["input_version"], financial_revision=b_row["financial_revision"], candidate_snapshot=None, snapshot_hash=None, findings=findings, required_field_ids=[])
        start_date = d_row["start_date"]
        opening_cash = int(bs["opening_cash_minor"])
        if bs.get("opening_date") != start_date.isoformat():
            findings.append(Finding(code="BASELINE-DATE-MISMATCH", field="baseline", message="Reconcile the opening balance to the order analysis start date.", blocking=True, resolution="correct_input"))
        if d_row["opening_cash_minor"] is not None and d_row["opening_cash_minor"] != opening_cash:
            findings.append(Finding(code="OPENING-BALANCE-CONFLICT", field="opening_cash_minor", message="The order balance differs from the owner-confirmed business balance. Update the dated business baseline.", blocking=True, resolution="correct_input"))
        if any(f.blocking for f in findings):
            return Review(deal_id=deal_id, version=d_row["version"], input_version=d_row["input_version"], financial_revision=b_row["financial_revision"], candidate_snapshot=None, snapshot_hash=None, findings=findings, required_field_ids=[])
        reserve = d_row["reserve_minor"] if d_row["reserve_minor"] is not None else c_row["safety_reserve_minor"]
        # Baseline events
        be_rows = (
            c.execute(
                text(
                    # Committed orders' projected events join the baseline with their
                    # immutable source-action attribution; their original cost rows do not.
                    "SELECT ce.*,cp.action_id AS projection_action_id FROM cash_event ce "
                    "LEFT JOIN commitment_projection cp ON cp.business_id=ce.business_id AND cp.cash_event_id=ce.id "
                    "WHERE ce.business_id=:b AND ce.voided_at IS NULL "
                    "AND (ce.deal_id IS NULL OR (cp.action_id IS NOT NULL AND ce.deal_id<>:d)) "
                    "ORDER BY ce.event_date ASC,ce.id ASC"
                ),
                {"b": business_id, "d": deal_id},
            )
            .mappings()
            .all()
        )
        if any(not e["evidence"] for e in be_rows):
            findings.append(Finding(code="CASH-EVENT-EVIDENCE-MISSING", field="baseline_events", message="Every projected baseline cash event needs evidence.", blocking=True, resolution="provide_evidence"))
            return Review(deal_id=deal_id, version=d_row["version"], input_version=d_row["input_version"], financial_revision=b_row["financial_revision"], candidate_snapshot=None, snapshot_hash=None, findings=findings, required_field_ids=[])
        baseline_events = [
            BaselineEvent(
                event_id=str(e["id"]),
                event_date=e["event_date"],
                amount_minor=str(e["amount_minor"]),
                direction=e["direction"],
                kind=e["kind"],
                certainty=e["certainty"],
                original_obligation_id=e["original_obligation_id"] or f"obl-{e['id']}",
                invoice_ref=e["invoice_ref"],
                projection_action_id=e["projection_action_id"],
                evidence=[Evidence.model_validate(v) for v in e["evidence"]] if e["evidence"] else [],
            )
            for e in be_rows
        ]
        # Deal costs
        cost_rows = (
            c.execute(
                text(
                    "SELECT * FROM cash_event ce WHERE business_id=:b AND deal_id=:d AND voided_at IS NULL "
                    "AND NOT EXISTS(SELECT FROM commitment_projection cp WHERE cp.business_id=ce.business_id AND cp.cash_event_id=ce.id) "
                    "ORDER BY event_date ASC,id ASC"
                ),
                {"b": business_id, "d": deal_id},
            )
            .mappings()
            .all()
        )
        if any(not row["evidence"] for row in cost_rows):
            findings.append(Finding(code="CASH-EVENT-EVIDENCE-MISSING", field="costs", message="Every projected order cost needs evidence.", blocking=True, resolution="provide_evidence"))
            return Review(deal_id=deal_id, version=d_row["version"], input_version=d_row["input_version"], financial_revision=b_row["financial_revision"], candidate_snapshot=None, snapshot_hash=None, findings=findings, required_field_ids=[])
        if any(e["event_date"] < start_date for e in [*be_rows, *cost_rows]):
            findings.append(Finding(code="PAST-EVENT-RECONCILIATION", field="cash_events", message="Past cash events require opening balance reconciliation before confirmation.", blocking=True, resolution="correct_input"))
            return Review(deal_id=deal_id, version=d_row["version"], input_version=d_row["input_version"], financial_revision=b_row["financial_revision"], candidate_snapshot=None, snapshot_hash=None, findings=findings, required_field_ids=[])
        costs = [
            CostInput(
                event_id=str(cr["id"]),
                cost_key=cr["cost_key"] or f"cost-{cr['id']}",
                event_date=cr["event_date"],
                amount_minor=str(cr["amount_minor"]),
                kind=cr["kind"],
                is_deferrable=cr["is_deferrable"],
                incremental=cr["incremental"],
                nonincremental_reason=None if cr["incremental"] else cr["description"],
                invoice_ref=cr["invoice_ref"],
                payee_id=cr["payee_id"],
                original_obligation_id=cr["original_obligation_id"] or f"obl-{cr['id']}",
                evidence=[Evidence.model_validate(v) for v in cr["evidence"]] if cr["evidence"] else [],
            )
            for cr in cost_rows
        ]
        # Offers
        offer_rows = (
            c.execute(
                select(financing_offer).where(
                    financing_offer.c.business_id == business_id,
                    financing_offer.c.status == "active",
                    financing_offer.c.kind == "term_loan",
                ),
            )
            .mappings()
            .all()
        )
        offers = [
            TermLoan(
                name=o["name"],
                kind="term_loan",
                interest_method=o["interest_method"] or "fixed_term",
                interest_bps=o["interest_bps"],
                fee_bps=o["fee_bps"],
                fee_flat_minor=str(o["fee_flat_minor"]),
                fee_at=o["fee_at"],
                lead_days=o["lead_days"],
                min_minor=str(o["min_minor"]),
                max_minor=str(o["max_minor"]),
                step_minor=str(o["step_minor"]),
                term_days=o["term_days"],
                available_from=o["available_from"],
                valid_until=o["valid_until"],
                status="active",
                payee_id=o["lender_payee_id"],
                payee_version=o["lender_payee_version"],
                account_id=o["lender_account_id"],
                account_version=o["lender_account_version"],
                evidence=o["evidence"] or [],
                offer_id=o["id"],
                version=o["version"],
            )
            for o in offer_rows
            if all(o[key] is not None for key in (
                "interest_method", "interest_bps", "fee_bps", "fee_flat_minor", "fee_at",
                "lead_days", "min_minor", "max_minor", "step_minor", "term_days",
                "available_from", "valid_until", "lender_payee_id", "lender_payee_version",
            )) and o["evidence"]
        ]
        for offer in offers:
            try:
                _validate_offer_sources(c, business_id, offer)
            except ApplicationError as exc:
                findings.append(Finding(code=exc.code, field="offers", message="Review the financing offer against the current lender and account record.", blocking=True, resolution="correct_input"))
        if any(f.blocking for f in findings):
            return Review(deal_id=deal_id, version=d_row["version"], input_version=d_row["input_version"], financial_revision=b_row["financial_revision"], candidate_snapshot=None, snapshot_hash=None, findings=findings, required_field_ids=[])
        strat_dict = c_row["strategy_space"] or {}
        strategy_space = StrategySpace(
            deposit_pcts=strat_dict.get("deposit_pcts", [0, 10, 20, 30, 40]),
            deposit_lead_days=c_row["deposit_lead_days"],
            extensions=strat_dict.get("extensions", []),
            offer_ids=[o.offer_id for o in offers],
            stages=1,
        )
        scenarios = Scenarios(
            downside=Stress(
                order_receipt_delay_days=c_row["downside_order_delay_days"],
                ar_delay_days=c_row["downside_ar_delay_days"],
                cost_overrun_bps=c_row["downside_cost_overrun_bps"],
                deposit_follows_delay=c_row["downside_deposit_follows_delay"],
                order_receipt_haircut_bps=c_row["downside_order_receipt_haircut_bps"],
            ),
            severe=Stress(
                order_receipt_delay_days=c_row["severe_order_delay_days"],
                ar_delay_days=c_row["severe_ar_delay_days"],
                cost_overrun_bps=c_row["severe_cost_overrun_bps"],
                deposit_follows_delay=c_row["severe_deposit_follows_delay"],
                order_receipt_haircut_bps=c_row.get("severe_order_receipt_haircut_bps") or 0,
            ),
        )
        owner = OwnerSettings(
            priorities=c_row["priorities"] or ["profit", "independence_customer", "simplicity"],
            min_order_profit_minor=str(c_row["min_order_profit_minor"]),
            max_financing_cost_minor=str(c_row["max_financing_cost_minor"])
            if c_row["max_financing_cost_minor"] is not None
            else None,
            target_scenario=c_row["target_scenario"],
            close_call_bps=c_row["close_call_bps"],
            max_deposit_concession_bps=c_row["max_deposit_concession_bps"],
            max_supplier_extension_days=c_row["max_supplier_extension_days"],
            max_negotiation_rounds=c_row["max_negotiation_rounds"] or 3,
            min_delay_tolerance_days=None,
            max_customer_concentration_bps=None,
            max_financing_cost_bps=None,
            constraints_id=c_row["id"],
            version=c_row["version"],
        )
        cov_through = (
            date.fromisoformat(bs["coverage_through"])
            if "coverage_through" in bs
            else start_date
        )
        related_sources = []
        payee_ids = {cost.payee_id for cost in costs if cost.payee_id is not None} | {offer.payee_id for offer in offers}
        for payee_id in sorted(payee_ids, key=str):
            source = c.execute(text("SELECT * FROM payee WHERE business_id=:b AND id=:id"), {"b": business_id, "id": payee_id}).mappings().one()
            payload = PayeeInput.model_validate({key: source[key] for key in PayeeInput.model_fields})
            related_sources.append(SourceRevision(resource_kind="payee", resource_id=str(payee_id), revision=source["version"], content_hash=canonical_hash(payload)))
        for account_id in sorted({offer.account_id for offer in offers if offer.account_id is not None}, key=str):
            source = c.execute(text("SELECT * FROM payee_bank_account WHERE business_id=:b AND id=:id"), {"b": business_id, "id": account_id}).mappings().one()
            payload = AccountView(id=source["id"], payee_id=source["payee_id"], version=source["version"], last4=source["last4"], bank_name=source["bank_name"], status=source["status"], verified_by=source["verified_by"], verified_at=source["verified_at"], verification_source=None)
            related_sources.append(SourceRevision(resource_kind="account", resource_id=str(account_id), revision=source["version"], content_hash=canonical_hash(payload)))
        candidate = ConfirmedInputV1(
            schema_version="confirmed-input.v1",
            business_id=business_id,
            deal_id=deal_id,
            input_version=d_row["input_version"],
            financial_revision=b_row["financial_revision"],
            source_revisions=[
                *related_sources,
                SourceRevision(resource_kind="customer", resource_id=str(d_row["customer_id"]), revision=c.execute(select(customer.c.version).where(customer.c.id == d_row["customer_id"])).scalar_one(), content_hash=canonical_hash(CustomerInput.model_validate(c.execute(text("SELECT name,known_domains,red_flags FROM customer WHERE business_id=:b AND id=:id"), {"b": business_id, "id": d_row["customer_id"]}).mappings().one()))),
                *[SourceRevision(resource_kind="cash_event", resource_id=str(row["id"]), revision=row["version"], content_hash=canonical_hash(event)) for row, event in zip(be_rows, baseline_events, strict=True)],
                *[SourceRevision(resource_kind="cash_event", resource_id=str(row["id"]), revision=row["version"], content_hash=canonical_hash(event)) for row, event in zip(cost_rows, costs, strict=True)],
                *[SourceRevision(resource_kind="offer", resource_id=str(o.offer_id), revision=o.version, content_hash=canonical_hash(o)) for o in offers],
                SourceRevision(
                    resource_kind="constraints",
                    resource_id=str(c_row["id"]),
                    revision=c_row["version"],
                    content_hash=canonical_hash(_row_to_constraints(c_row, c_row["id"], b_row["financial_revision"])),
                )
            ],
            start_date=start_date,
            currency=d_row["currency"],
            exponent=2,
            opening_cash_minor=str(opening_cash),
            reserve_minor=str(reserve),
            baseline_revision=b_row["financial_revision"],
            coverage_through=cov_through,
            balance_evidence=[
                Evidence.model_validate(bs["evidence"])
            ],
            baseline_events=baseline_events,
            order=OrderInput(
                customer_id=d_row["customer_id"],
                customer_version=c.execute(select(customer.c.version).where(customer.c.business_id == business_id, customer.c.id == d_row["customer_id"])).scalar_one(),
                po_number=d_row["po_number"] or d_row["public_ref"],
                order_value_minor=str(d_row["order_value_minor"]),
                order_date=d_row["order_date"],
                invoice_date=d_row["invoice_date"],
                delivery_date=d_row["delivery_date"],
                payment_basis=d_row["payment_basis"],
                payment_days=d_row["payment_days"],
                convention="calendar",
                deposit_discount_bps=d_row["deposit_discount_bps"] or 0,
                deposit_discount_bps_per_10pct=d_row["deposit_discount_bps_per_10pct"] or 0,
                cancellation_clause=d_row["cancellation_clause"] or "none",
                late_penalty_bps_per_day=None,
                costs=costs,
            ),
            offers=offers,
            owner=owner,
            strategy_space=strategy_space,
            scenarios=scenarios,
            analysis=AnalysisConfig(
                scan_days=60,
                max_horizon_days=1095,
                max_work_units=100_000_000,
                sensitivity=[],
                uncertainty_questions=[],
            ),
            assumptions=["Manual deal input verified by authorized user"],
            conflict_resolutions=[],
            coverage_acknowledgement=None,
        )
        if d_row["analysis_changes"]:
            from pydantic import TypeAdapter

            from orderfit.contracts.workflow import WhatIfChange
            from orderfit.services.preparation import fork_snapshot
            candidate = fork_snapshot(candidate, TypeAdapter(list[WhatIfChange]).validate_python(d_row["analysis_changes"]))
        snap_hash = canonical_hash(candidate)
        return Review(
            deal_id=deal_id,
            version=d_row["version"],
            input_version=d_row["input_version"],
            financial_revision=b_row["financial_revision"],
            candidate_snapshot=candidate,
            snapshot_hash=snap_hash,
            findings=findings,
            required_field_ids=required_field_ids,
        )

    @staticmethod
    def confirm(c, scope, deal_id: UUID, req: ConfirmInputs, idempotency_key: str) -> SnapshotConfirmed:
        b = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if b != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        d = (
            c.execute(
                text("SELECT * FROM deal WHERE business_id=:b AND id=:d FOR UPDATE"),
                {"b": scope.business_id, "d": deal_id},
            )
            .mappings()
            .one_or_none()
        )
        if not d:
            raise ApplicationError(404, "NOT_FOUND")
        if (d["version"], d["input_version"]) != (req.expected_version, req.expected_input_version):
            raise ApplicationError(409, "STALE_INPUT_VERSION")
        review = DealRepository.build_review(c, scope.business_id, deal_id)
        if review.candidate_snapshot is None or review.snapshot_hash != req.snapshot_hash:
            raise ApplicationError(409, "SNAPSHOT_HASH_MISMATCH")
        unack = [
            f.code
            for f in review.findings
            if not f.blocking and f.code not in req.acknowledged_warning_codes
        ]
        if unack:
            raise ApplicationError(422, "UNACKNOWLEDGED_WARNINGS",
                                   "Acknowledge all review warnings before confirming.")
        if d["status"] == "ingesting":
            # The snapshot guard requires review state before immutable snapshot insert.
            c.execute(
                text("UPDATE deal SET status='awaiting_confirm' WHERE id=:d AND business_id=:b"),
                {"d": deal_id, "b": scope.business_id},
            )
        snap_id = uuid4()
        now = datetime.now(UTC)
        candidate = review.candidate_snapshot
        canon_bytes = canonical_bytes(candidate)
        hash_bytes = bytes.fromhex(review.snapshot_hash)
        c.execute(
            text(
                """INSERT INTO input_snapshot (
                    id, business_id, deal_id, input_version, financial_revision,
                    schema_version, payload, canonical_payload, snapshot_hash,
                    confirmed_by, confirmed_at
                ) VALUES (
                    :id, :b, :d, :iv, :fr, 'confirmed-input.v1', CAST(:payload AS jsonb),
                    :cbytes, :hbytes, :u, :now
                )"""
            ),
            {
                "id": snap_id,
                "b": scope.business_id,
                "d": deal_id,
                "iv": d["input_version"],
                "fr": b,
                "payload": json.dumps(candidate.model_dump(mode="json")),
                "cbytes": canon_bytes,
                "hbytes": hash_bytes,
                "u": scope.user_id,
                "now": now,
            },
        )
        app_id = uuid4()
        c.execute(
            text(
                """INSERT INTO approval (
                    id, business_id, deal_id, action, action_plan_hash,
                    approver_id, decision, idempotency_key, created_at
                ) VALUES (
                    :id, :b, :d, 'confirm_figures', :hbytes, :u, 'approved', :key, :now
                )"""
            ),
            {
                "id": app_id,
                "b": scope.business_id,
                "d": deal_id,
                "hbytes": hash_bytes,
                "u": scope.user_id,
                "now": now,
                "key": idempotency_key,
            },
        )
        append_audit(
            c,
            scope,
            "confirm_deal_inputs",
            deal_id=deal_id,
            payload={"snapshot_id": str(snap_id), "hash": review.snapshot_hash},
        )
        updated = c.execute(select(deal).where(deal.c.id == deal_id)).mappings().one()
        return SnapshotConfirmed(
            snapshot_id=snap_id,
            snapshot_hash=review.snapshot_hash,
            approval_id=app_id,
            version=updated["version"],
            input_version=updated["input_version"],
            financial_revision=b,
            confirmed_at=now,
        )


class EvaluationRepository:
    @staticmethod
    def list_evaluations(
        c, business_id: UUID, deal_id: UUID, limit: int = 50, offset: int = 0, *, cursor=None, cursors=None, scope=None
    ) -> Page[EvaluationResultV1]:
        rows, continuation = collection_page(
            c, select(evaluation).where(evaluation.c.business_id == business_id, evaluation.c.deal_id == deal_id), evaluation, business_id, evaluation.c.created_at, limit, offset,
            cursor=cursor, cursors=cursors, scope=scope, filters={"deal_id": deal_id})
        items = [EvaluationRepository._current_result(c, business_id, r) for r in rows]
        return Page(items=items, next_cursor=continuation)

    @staticmethod
    def get_evaluation(c, business_id: UUID, evaluation_id: UUID) -> EvaluationResultV1:
        row = (
            c.execute(
                select(evaluation).where(
                    evaluation.c.business_id == business_id,
                    evaluation.c.id == evaluation_id,
                ),
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        return EvaluationRepository._current_result(c, business_id, row)

    @staticmethod
    def _current_result(c, business_id, row):
        result = EvaluationResultV1.model_validate(row["output"])
        versions = c.execute(text("SELECT d.input_version,b.financial_revision FROM deal d JOIN business b ON b.id=d.business_id WHERE d.business_id=:b AND d.id=:d"), {"b": business_id, "d": row["deal_id"]}).mappings().one()
        reasons = []
        if result.input_version != versions["input_version"]:
            reasons.append("STALE_INPUT_VERSION")
        if result.financial_revision != versions["financial_revision"]:
            reasons.append("STALE_FINANCIAL_REVISION")
        if row["superseded_at"] is not None:
            reasons.append("SUPERSEDED_EVALUATION")
        return result.model_copy(update={"is_stale": bool(reasons), "stale_reasons": reasons,
            "allowed_actions": ["view_details"] if reasons else result.allowed_actions})

    @staticmethod
    def get_evaluation_series(
        c, business_id: UUID, evaluation_id: UUID, scenario: str = "base", option_key: str | None = None
    ) -> Series:
        row = (
            c.execute(
                select(evaluation).where(
                    evaluation.c.business_id == business_id,
                    evaluation.c.id == evaluation_id,
                ),
            )
            .mappings()
            .one_or_none()
        )
        if not row:
            raise ApplicationError(404, "NOT_FOUND")
        opt_key = option_key or row["recommended_option_key"] or "accept_as_is"
        stored = c.execute(select(evaluation_series).where(
            evaluation_series.c.business_id == business_id,
            evaluation_series.c.evaluation_id == evaluation_id,
            evaluation_series.c.option_key == opt_key,
            evaluation_series.c.scenario == scenario,
        )).mappings().one_or_none()
        if stored is None:
            raise ApplicationError(404, "EVALUATION_SERIES_NOT_FOUND")
        return Series.model_validate({"evaluation_id": evaluation_id, "option_key": opt_key,
            "scenario": scenario, "currency": stored["currency"], "exponent": stored["exponent"],
            "points": stored["points"]})

    @staticmethod
    def publish_evaluation(c, scope, eval_dto: EvaluationResultV1, snapshot: ConfirmedInputV1, computation):
        # 1. Supersede any existing live evaluation for this deal
        c.execute(
            text(
                "UPDATE evaluation SET superseded_at=clock_timestamp() WHERE business_id=:b AND deal_id=:d AND superseded_at IS NULL"
            ),
            {"b": snapshot.business_id, "d": snapshot.deal_id},
        )
        # 2. Insert evaluation row. Summary columns describe the selected option.
        summary = next((opt for opt in eval_dto.ranked_candidates if opt.option_key == eval_dto.recommended_option_key), eval_dto.as_is)
        c.execute(
            text(
                """INSERT INTO evaluation (
                    id, business_id, deal_id, round, engine_version, input_hash,
                    inputs, output, verdict, verdict_code, first_breach_date,
                    lowest_balance_minor, recommended_option_key,
                    recommended_delay_tolerance_days, snapshot_id, input_version,
                    financial_revision, tolerance_status, created_at
                ) VALUES (
                    :id, :b, :d,
                    (SELECT negotiation_round FROM deal WHERE business_id=:b AND id=:d),
                    :eversion, :ihash,
                    CAST(:inputs AS jsonb), CAST(:output AS jsonb), :verdict, :vcode,
                    :first_breach, :lowest_bal, :rec_key, :rec_delay,
                    :snap_id, :iv, :fr, :tol_status, clock_timestamp()
                )"""
            ),
            {
                "id": eval_dto.id,
                "b": snapshot.business_id,
                "d": snapshot.deal_id,
                "eversion": eval_dto.calculator_version,
                "ihash": bytes.fromhex(eval_dto.reference_input_hash),
                "inputs": json.dumps(snapshot.model_dump(mode="json")),
                "output": json.dumps(eval_dto.model_dump(mode="json")),
                "verdict": {"accept_as_is":"feasible_as_offered", "accept_with_changes":"plan_recommended", "decline_or_renegotiate":"no_feasible_plan"}[eval_dto.decision],
                "vcode": eval_dto.reason_codes[0] if eval_dto.reason_codes else None,
                "first_breach": next((s.first_breach_date for s in summary.scenarios if s.scenario == "base"), None),
                "lowest_bal": int(summary.scenarios[0].lowest_balance_minor),
                "rec_key": eval_dto.recommended_option_key,
                "rec_delay": summary.tolerance.observed_safe_days if eval_dto.recommended_option_key else None,
                "snap_id": eval_dto.snapshot_id,
                "iv": snapshot.input_version,
                "fr": snapshot.financial_revision,
                "tol_status": summary.tolerance.status,
            },
        )
        # 3. Insert evaluation options
        options = {opt.option_key: opt for opt in [eval_dto.as_is, *eval_dto.ranked_candidates, *eval_dto.option_catalogue]}
        for opt in options.values():
            c.execute(
                text(
                    """INSERT INTO evaluation_option (
                        business_id, evaluation_id, option_key, rank, levers,
                        delay_tolerance_days, cost_minor, borrowed_minor,
                        lowest_balance_minor, meets_target, tolerance_status, tolerance_scan_cap
                    ) VALUES (
                        :b, :eid, :okey, :rank, CAST(:levers AS jsonb),
                        :delay_tol, :cost, :borrowed, :lowest_bal, :meets, :tol_status, :scan_cap
                    )"""
                ),
                {
                    "b": snapshot.business_id,
                    "eid": eval_dto.id,
                    "okey": opt.option_key,
                    "rank": opt.rank,
                    "levers": json.dumps(opt.parameters.model_dump(mode="json")),
                    "delay_tol": opt.tolerance.observed_safe_days,
                    "cost": int(opt.financing_cost_minor),
                    "borrowed": int(opt.borrowed_minor),
                    "lowest_bal": min(int(s.lowest_balance_minor) for s in opt.scenarios),
                    "meets": opt.meets_target,
                    "tol_status": opt.tolerance.status,
                    "scan_cap": opt.tolerance.scan_cap_days,
                },
            )
        # Persist full series in the tenant-scoped immutable extension table; reads never rerun analysis.
        for opt in options.values():
            for scenario in ("base", "downside", "severe"):
                series = extract_series(computation.result, snapshot, eval_dto.id, scenario, opt.option_key)
                c.execute(text("INSERT INTO evaluation_series (business_id,evaluation_id,option_key,scenario,currency,exponent,points) VALUES (:b,:e,:o,:s,:c,:x,CAST(:p AS jsonb))"), {
                    "b": snapshot.business_id, "e": eval_dto.id, "o": opt.option_key,
                    "s": scenario, "c": series.currency, "x": series.exponent,
                    "p": json.dumps([point.model_dump(mode="json") for point in series.points]),
                })
        # Immutable engine-dated order/financing events per option: the only source a commit
        # manifest may use for receipts, surcharge-bearing costs and loan fee/interest timing.
        from orderfit.agent.nodes.compute import dated_commitment_events

        for opt in options.values():
            if opt.parameters.kind == "decline":
                continue
            events = dated_commitment_events(computation.result, opt.option_key)
            c.execute(
                text(
                    "INSERT INTO evaluation_projection(business_id,evaluation_id,option_key,events) "
                    "VALUES(:b,:e,:o,CAST(:events AS jsonb))"
                ),
                {
                    "b": snapshot.business_id,
                    "e": eval_dto.id,
                    "o": opt.option_key,
                    "events": json.dumps([e.model_dump(mode="json") for e in events]),
                },
            )
        # 4. Advance deal status to awaiting_approval
        c.execute(
            text("UPDATE deal SET status='awaiting_approval' WHERE id=:d AND business_id=:b"),
            {"d": snapshot.deal_id, "b": snapshot.business_id},
        )
        append_audit(
            c,
            scope,
            "publish_evaluation",
            deal_id=snapshot.deal_id,
            payload={"evaluation_id": str(eval_dto.id), "verdict": eval_dto.decision},
        )
