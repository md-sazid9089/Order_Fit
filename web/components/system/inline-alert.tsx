import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "cn";
import type { Tone } from "./status-badge";

type AlertTone = Extract<Tone, "info" | "success" | "warning" | "danger">;

const STYLES: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: "border-info/25 bg-info-soft text-foreground", icon: <Info className="size-4 text-info" aria-hidden /> },
  success: { box: "border-success/25 bg-success-soft text-foreground", icon: <CheckCircle2 className="size-4 text-success" aria-hidden /> },
  warning: { box: "border-warning/30 bg-warning-soft text-foreground", icon: <AlertTriangle className="size-4 text-warning" aria-hidden /> },
  danger: { box: "border-danger/30 bg-danger-soft text-foreground", icon: <XCircle className="size-4 text-danger" aria-hidden /> },
};

/**
 * Persistent, in-place message. Failures use role="alert" so they are announced; notices use role="status".
 * A toast may repeat it, but never replaces it.
 */
export function InlineAlert({
  tone = "info",
  title,
  children,
  action,
  reference,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  reference?: string | null;
  className?: string;
}) {
  const style = STYLES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", style.box, className)}>
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-6 text-foreground/85">{children}</div>}
        {reference && (
          <p className="text-xs text-muted-foreground">
            Reference <span className="font-mono">{reference}</span>
          </p>
        )}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}
