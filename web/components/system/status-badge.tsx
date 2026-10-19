import type { ReactNode } from "react";
import { cn } from "cn";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  info: "bg-info-soft text-info border-info/25",
  primary: "bg-accent text-accent-foreground border-primary/20",
};

/** Status, verdict and workflow-state pill. Always carries text; color is never the only signal. */
export function StatusBadge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
