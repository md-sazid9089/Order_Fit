// Compile-only consumer examples. Never runtime financial arithmetic.
import type { ConfirmedInputV1, Operations, ForkRequest } from "./frontend-api";

declare const snapshot: ConfirmedInputV1;
const money: string = snapshot.order.order_value_minor;
const eventId: string = snapshot.baseline_events[0].event_id;
// @ts-expect-error Money must not become an unsafe JavaScript number.
const invalidMoney: number = snapshot.opening_cash_minor;
// @ts-expect-error BIGINT identity remains a string above MAX_SAFE_INTEGER.
const invalidId: number = snapshot.baseline_events[0].event_id;

const fork: ForkRequest = {
  expected_version: 7,
  source_snapshot_id: "d4967f9b-f8bf-43ae-a18a-e32b81db7297",
  expected_input_version: 3,
  expected_financial_revision: 4,
  changes: [{ kind: "customer_delay_days", value: 15 }],
};
// @ts-expect-error Arbitrary JSON/SQL patches are not supported changes.
const invalidFork: NonNullable<ForkRequest["changes"]>[number] = { kind: "sql", value: "query" };
const create: Operations["deal_create"]["request"] = {
  public_ref: "PO-SYNTHETIC", start_date: "2026-11-02",
  constraints_id: "d4967f9b-f8bf-43ae-a18a-e32b81db7297", customer_id: null,
};
const headers: Operations["deal_create"]["headers"] = {
  "Idempotency-Key": "synthetic-key", "X-CSRF-Token": "synthetic-csrf",
};
// @ts-expect-error Required idempotency and CSRF headers are generated.
const invalidHeaders: Operations["deal_create"]["headers"] = {};
void [money, eventId, fork, create, headers, invalidMoney, invalidId, invalidFork, invalidHeaders];
