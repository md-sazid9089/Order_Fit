import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * One figure with its label and context. The value is set in tabular figures and never holds a sentence:
 * status words go in `status`, explanations in `caption`.
 */
export function StatTile({
  label,
  value,
  caption,
  status,
  action,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {status}
      </div>
      <p className="tabular text-2xl font-semibold tracking-tight text-foreground break-words">{value}</p>
      {(caption || action) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          {caption && <span className="min-w-0">{caption}</span>}
          {action}
        </div>
      )}
    </div>
  );
}
