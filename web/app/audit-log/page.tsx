import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { AuditScreen } from "@/components/audit/audit-screen";

export default function Page() { return <AuthenticatedPage><AuditScreen /></AuthenticatedPage>; }
