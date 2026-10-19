import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "cn";
import type { Deal } from "@/lib/orderfit-api";

type StepKey = "enter" | "review" | "evaluate" | "negotiate" | "approve";
type StepState = "done" | "current" | "upcoming";

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "enter", label: "Enter order" },
  { key: "review", label: "Review inputs" },
  { key: "evaluate", label: "Evaluate" },
  { key: "negotiate", label: "Negotiate" },
  { key: "approve", label: "Approve and run" },
];

/** Where a saved order really is in its journey, derived only from server state. */
export function journeyPosition(deal: Pick<Deal, "status" | "live_evaluation_id" | "is_stale"> | null | undefined): { current: StepKey; complete: boolean } {
  if (!deal) return { current: "enter", complete: false };
  if (deal.status === "committed" || deal.status === "closed") return { current: "approve", complete: true };
  if (deal.status === "awaiting_approval" || deal.status === "awaiting_reply") return { current: "approve", complete: false };
  if (deal.status === "computing") return { current: "evaluate", complete: false };
  if (deal.live_evaluation_id && !deal.is_stale) return { current: "negotiate", complete: false };
  return { current: "review", complete: false };
}

/**
 * Compact journey indicator for the order workflow. It never claims a step happened: states come from the saved order.
 * Steps link only where the destination is meaningful for the current state.
 */
export function OrderJourney({
  deal,
  dealId,
  businessId,
  className,
}: {
  deal?: Pick<Deal, "status" | "live_evaluation_id" | "is_stale"> | null;
  dealId?: string | null;
  businessId?: string | null;
  className?: string;
}) {
  const { current, complete } = journeyPosition(deal);
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  const hrefFor = (key: StepKey): string | null => {
    if (!dealId) return null;
    const base = `/deals/${encodeURIComponent(dealId)}`;
    if (key === "review" || key === "evaluate") return `${base}${query}`;
    if (key === "negotiate" || key === "approve") return `${base}/negotiate${query}`;
    return null;
  };
  return (
    <nav aria-label="Order progress" className={cn("w-full min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {STEPS.map((step, index) => {
          const state: StepState = complete || index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          const href = state === "upcoming" ? null : hrefFor(step.key);
          const content = (
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-2.5 py-1 transition-colors",
                state === "current" && "bg-accent font-semibold text-accent-foreground",
                state === "done" && "text-foreground",
                state === "upcoming" && "text-muted-foreground"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-5 place-items-center rounded-full border text-[0.75rem] tabular",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary text-primary",
                  state === "upcoming" && "border-border-strong"
                )}
              >
                {state === "done" ? <Check className="size-3" /> : index + 1}
              </span>
              {step.label}
              <span className="sr-only">{state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}</span>
            </span>
          );
          return (
            <li key={step.key} className="flex items-center gap-1" aria-current={state === "current" ? "step" : undefined}>
              {index > 0 && <span aria-hidden className={cn("hidden h-px w-4 lg:block", index <= currentIndex ? "bg-primary/50" : "bg-border-strong/60")} />}
              {href ? (
                <Link href={href} className="rounded-full hover:bg-muted">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
