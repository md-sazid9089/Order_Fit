import type { ReactNode } from "react";
import { UnavailablePage } from "@/components/unavailable-notice";
import { platformAdminEnabled } from "@/lib/platform-admin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!platformAdminEnabled()) {
    return <UnavailablePage title="Platform administration" reason="Platform administration is unavailable with the current backend. Business owners can manage their own business through the workspace." href="/deals" linkLabel="Back to orders" />;
  }
  return children;
}
