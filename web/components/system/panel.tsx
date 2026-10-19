import type { ReactNode } from "react";
import { cn } from "cn";

/** A flat section with a hairline border. Panels are never nested; use dividers inside one instead. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-2xl border border-border bg-card text-card-foreground", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
