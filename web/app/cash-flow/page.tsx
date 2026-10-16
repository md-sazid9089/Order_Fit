import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { CashFlowScreen } from "@/components/cash/cash-flow-screen";

export default function Page() { return <AuthenticatedPage><CashFlowScreen /></AuthenticatedPage>; }
