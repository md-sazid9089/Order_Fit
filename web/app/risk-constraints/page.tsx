import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { RiskScreen } from "@/components/financing/risk-screen";

export default function Page() { return <AuthenticatedPage><RiskScreen /></AuthenticatedPage>; }
