"use client";
import { formatMinor } from "@/lib/approval-model";
import type { CashEventDuplicateMatch } from "@/lib/generated-api";

export function DuplicateReviewFields({ matches, currency, reason, onReason }: { matches: readonly CashEventDuplicateMatch[]; currency: string; reason: string; onReason: (value: string) => void }) {
  return <div className="space-y-3 rounded-xl border border-warning bg-warning-soft p-4">
    <p className="font-medium">Compare matching obligations</p>
    <ul className="space-y-2 text-sm">{matches.map(event => <li key={event.id}>{event.event_date} · {formatMinor(event.amount_minor, currency)} · {event.direction === "in" ? "Receipt" : "Payment"} · {event.description || event.kind.replaceAll("_", " ")} · reference {event.id}</li>)}</ul>
    <p className="text-sm">Correct or cancel a duplicate. If both entries are genuine, explain the separate source obligations. Both will remain in cash calculations.</p>
    <label className="block text-sm">Reason these are distinct obligations (12–2000 characters)<textarea className="mt-2 w-full rounded-lg border border-border bg-card p-3" minLength={12} maxLength={2000} value={reason} onChange={event => onReason(event.target.value)} /></label>
  </div>;
}
