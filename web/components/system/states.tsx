import type { ReactNode } from "react";
import { cn } from "cn";
import { InlineAlert } from "./inline-alert";

/** Explains why a list or section is empty and offers the next action. Never used for failures. */
export function EmptyState({ title, children, action, icon, className }: { title: ReactNode; children?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-xl border border-dashed border-border-strong/70 px-5 py-8 sm:items-center sm:text-center", className)}>
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children && <p className="max-w-[56ch] text-sm leading-6 text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  );
}

/** A failed read. Keeps the user's place, says what happened and offers a retry. */
export function ErrorState({
  title = "This couldn't load",
  message,
  onRetry,
  retrying,
  retryLabel = "Try again",
  reference,
  className,
}: {
  title?: ReactNode;
  message: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  reference?: string | null;
  className?: string;
}) {
  return (
    <InlineAlert
      tone="danger"
      title={title}
      reference={reference}
      className={className}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {retrying ? "Retrying…" : retryLabel}
          </button>
        )
      }
    >
      {message}
    </InlineAlert>
  );
}
