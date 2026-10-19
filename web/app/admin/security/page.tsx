import { PageHeader } from "@/components/system/page-header";
import { Panel } from "@/components/system/panel";

// Every statement here describes what the backend enforces today (see backend/AGENTS.md, services/bundles.py,
// services/identity.py, migrations/sql RLS policies and workflow/execution.py). Nothing aspirational belongs here.
const CONTROLS: Array<{ title: string; body: string }> = [
  {
    title: "Sessions and requests",
    body: "Sign-in creates an opaque, HttpOnly session cookie; no token is stored in the browser. Every change sends a fresh CSRF token and an idempotency key, so a retried request is never applied twice. Pages are served with a strict, per-request nonce Content Security Policy.",
  },
  {
    title: "Business isolation",
    body: "All businesses share one PostgreSQL database protected by row-level security. Each request runs with the verified user and business from the session, so one business's rows are not readable by another. The API and worker use restricted database logins, never the migration owner.",
  },
  {
    title: "Roles",
    body: "Inside a business, viewer, auditor, commercial lead, risk officer and owner roles decide what a person can see and do. The API checks the role on every request; hiding a button is only a convenience. Changing someone's role ends their existing sessions.",
  },
  {
    title: "Approvals",
    body: "Outgoing actions are grouped into an exact package bound to the order's inputs, the evaluation and the content's hash. An owner or risk officer approves it after re-entering their password in the same session, and a package that changes or expires must be approved again. Passkeys can be added as a second factor at sign-in.",
  },
  {
    title: "Effects are sandbox-only",
    body: "Approved packages run against a local sandbox. No email, bank, payment or lender integration exists in this release, so nothing leaves the system.",
  },
  {
    title: "Calculations and AI",
    body: "A deterministic engine computes every figure, feasibility check and recommendation. AI, when enabled, only proposes values from documents and wording for messages; a person reviews each proposal, and AI cannot change confirmed inputs, approve or send anything.",
  },
  {
    title: "Audit trail",
    body: "Each business has an append-only, hash-chained log of its operations that members with audit access can view and export with verification. There is no cross-business security log in this console.",
  },
  {
    title: "Documents",
    body: "Uploads are checked by content type and size, read in an isolated, time-limited parser and stored privately. PDFs need a text layer: scanned images are flagged, not read, and Word or Excel files are not supported.",
  },
];

export default function AdminSecurityPage() {
  return (
    <>
      <PageHeader title="Security model" description="How OrderFit protects businesses and their data in this release. These controls are enforced by the server, not by this page." />
      <div className="grid gap-4 lg:grid-cols-2">
        {CONTROLS.map((control) => (
          <Panel key={control.title} title={control.title}>
            <p className="text-sm leading-6 text-foreground/85">{control.body}</p>
          </Panel>
        ))}
      </div>
    </>
  );
}
