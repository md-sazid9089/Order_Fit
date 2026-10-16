import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { CapabilitiesScreen } from "@/components/admin/capabilities-screen";

export default function Page() { return <AuthenticatedPage><CapabilitiesScreen /></AuthenticatedPage>; }
