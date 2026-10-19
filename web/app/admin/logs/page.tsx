import Link from "next/link";
import { PageHeader } from "@/components/system/page-header";
import { InlineAlert } from "@/components/system/inline-alert";

// The backend deliberately returns 503 ADMIN_TELEMETRY_UNAVAILABLE for /admin/logs: there is no global log feed.
export default function AdminLogsPage() {
  return (
    <>
      <PageHeader title="Platform logs" />
      <InlineAlert tone="info" title="There is no cross-business log in this release">
        Each business keeps its own hash-chained operation log. Members with audit access can open it under{" "}
        <Link href="/audit-log" className="font-medium text-primary underline">Operation Audit Log</Link> inside that business. Server logs remain with the
        deployment&apos;s hosting provider.
      </InlineAlert>
    </>
  );
}
