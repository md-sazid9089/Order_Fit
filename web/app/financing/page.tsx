import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { FinancingScreen } from "@/components/financing/financing-screen";

export default function Page() { return <AuthenticatedPage><FinancingScreen /></AuthenticatedPage>; }
