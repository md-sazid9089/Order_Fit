import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { checkState, type AdminSystem } from "@/lib/admin-api";

const LABELS: Record<keyof AdminSystem["checks"], { title: string; detail: string }> = {
  database: { title: "Database", detail: "The API can reach its database." },
  schema_current: { title: "Database schema", detail: "The database is on the migration this release requires." },
  storage_writable: { title: "Document storage", detail: "Uploaded documents can be stored." },
  worker_active: { title: "Background worker", detail: "A worker has checked in recently to run evaluations and other tasks." },
};

/** Each check is OK, failed or unknown. Unknown is shown as unknown, never as healthy. */
export function SystemChecks({ system }: { system: AdminSystem }) {
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(LABELS) as Array<keyof AdminSystem["checks"]>).map((key) => {
          const state = checkState(system.checks[key]);
          return (
            <li key={key} className="flex gap-3 rounded-xl border border-border p-3">
              {state === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : state === "failed" ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> : <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {LABELS[key].title} <span className="font-normal text-muted-foreground">· {state === "ok" ? "OK" : state === "failed" ? "Failing" : "Unknown"}</span>
                </p>
                <p className="text-sm text-muted-foreground">{LABELS[key].detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Checked {new Date(system.checked_at).toLocaleString()}.</p>
    </div>
  );
}
