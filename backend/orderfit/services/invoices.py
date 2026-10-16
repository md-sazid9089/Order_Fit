"""P7 customer invoice history: typed import batches, keyset listing, explicit as-of context.

History is contextual evidence only (``context_only``): it never becomes an automatic credit
score or engine constraint. As-of semantics (DB-30): an invoice counts only if issued on or
before ``as_of``; ``paid_date`` is the date of the last payment, so a payment dated after
``as_of`` is treated as not yet received at ``as_of`` (partial payment timing before the last
payment is not recorded and is not inferred).
"""

from datetime import date
from uuid import uuid4

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import Page
from orderfit.contracts.resources import CustomerHistory, InvoiceImport, InvoiceInput, InvoiceView
from orderfit.services.pagination import page_limit, split_page
from orderfit.store.repositories import append_audit

LISTING = "customer_invoices"
COLUMNS = "id,customer_id,invoice_ref,invoice_date,due_date,amount_minor,paid_minor,paid_date"


def _customer(c, scope, customer_id, *, writable):
    row = c.execute(text("SELECT archived_at FROM customer WHERE business_id=:b AND id=:id"),
                    {"b": scope.business_id, "id": customer_id}).mappings().one_or_none()
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    if writable and row["archived_at"] is not None:
        raise ApplicationError(409, "CUSTOMER_ARCHIVED")


def _view(row) -> InvoiceView:
    return InvoiceView(id=row["id"], customer_id=row["customer_id"], invoice=InvoiceInput(
        invoice_ref=row["invoice_ref"], invoice_date=row["invoice_date"], due_date=row["due_date"],
        amount_minor=str(row["amount_minor"]), paid_minor=str(row["paid_minor"]), paid_date=row["paid_date"]))


def _page(c, scope, cursors, customer_id, import_id, after, limit) -> Page[InvoiceView]:
    filters = {"customer_id": customer_id, "import_id": import_id}
    rows = c.execute(text(
        "SELECT " + COLUMNS + " FROM customer_invoice WHERE business_id=:b AND customer_id=:c "
        "AND (CAST(:imp AS uuid) IS NULL OR import_id=CAST(:imp AS uuid)) "
        "AND (CAST(:d AS date) IS NULL OR (invoice_date,id)<(CAST(:d AS date),CAST(:i AS uuid))) "
        "ORDER BY invoice_date DESC,id DESC LIMIT :n"),
        {"b": scope.business_id, "c": customer_id, "imp": import_id, "d": after[0] if after else None,
         "i": after[1] if after else None, "n": limit + 1}).mappings().all()
    rows, more = split_page(rows, limit)
    next_cursor = None
    if more:
        next_cursor = cursors.encode(business_id=scope.business_id, user_id=scope.user_id, listing=LISTING,
                                     filters=filters, position=[rows[-1]["invoice_date"].isoformat(), rows[-1]["id"]])
    return Page[InvoiceView](items=[_view(r) for r in rows], next_cursor=next_cursor)


def list_invoices(c, scope, cursors, customer_id, cursor, limit) -> Page[InvoiceView]:
    """A cursor returned by an import continues that import batch only (signed filter)."""
    limit = page_limit(limit)
    _customer(c, scope, customer_id, writable=False)
    import_id, after = None, None
    if cursor is not None:
        bound, after = cursors.decode_with_filters(cursor, business_id=scope.business_id,
                                                   user_id=scope.user_id, listing=LISTING)
        if set(bound) != {"customer_id", "import_id"} or bound["customer_id"] != str(customer_id):
            raise ApplicationError(422, "INVALID_CURSOR", "Restart the listing from the first page.")
        import_id = bound["import_id"]
    return _page(c, scope, cursors, customer_id, import_id, after, limit)


def import_invoices(c, scope, cursors, customer_id, command: InvoiceImport) -> Page[InvoiceView]:
    """All-or-nothing typed batch. Duplicate references (in the batch or already stored for
    this customer) are rejected rather than merged; each row bumps the financial revision."""
    revision = c.execute(text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
                         {"b": scope.business_id}).scalar_one()
    if revision != command.expected_financial_revision:
        raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
    _customer(c, scope, customer_id, writable=True)
    refs = [i.invoice_ref for i in command.invoices]
    if len(set(refs)) != len(refs):
        raise ApplicationError(422, "DUPLICATE_INVOICE_REF")
    if c.execute(text("SELECT EXISTS(SELECT FROM customer_invoice WHERE business_id=:b AND customer_id=:c AND invoice_ref=ANY(:r))"),
                 {"b": scope.business_id, "c": customer_id, "r": refs}).scalar_one():
        raise ApplicationError(409, "DUPLICATE_INVOICE_REF")
    import_id = str(uuid4())
    c.execute(text(
        "INSERT INTO customer_invoice(business_id,customer_id,invoice_ref,invoice_date,due_date,amount_minor,paid_minor,paid_date,import_id) "
        "VALUES(:b,:c,:ref,:inv,:due,:amount,:paid,:paid_date,CAST(:imp AS uuid))"),
        [{"b": scope.business_id, "c": customer_id, "ref": i.invoice_ref, "inv": i.invoice_date, "due": i.due_date,
          "amount": int(i.amount_minor), "paid": int(i.paid_minor), "paid_date": i.paid_date, "imp": import_id}
         for i in command.invoices])
    append_audit(c, scope, "customer_invoices_imported",
                 payload={"customer_id": str(customer_id), "import_id": import_id, "rows": len(refs)})
    return _page(c, scope, cursors, customer_id, import_id, None, 100)


def history_as_of(c, scope, customer_id, as_of: date) -> CustomerHistory:
    _customer(c, scope, customer_id, writable=False)
    row = c.execute(text("""
        SELECT count(*) FILTER (WHERE paid_minor=amount_minor AND paid_date<=:a) AS paid_count,
               coalesce(sum(amount_minor - CASE WHEN paid_date<=:a THEN paid_minor ELSE 0 END)
                        FILTER (WHERE due_date<:a), 0) AS open_overdue
        FROM customer_invoice WHERE business_id=:b AND customer_id=:c AND invoice_date<=:a
    """), {"b": scope.business_id, "c": customer_id, "a": as_of}).mappings().one()
    return CustomerHistory(as_of=as_of, customer_id=customer_id, paid_count=row["paid_count"],
                           open_overdue_minor=str(row["open_overdue"]), context_only=True)
