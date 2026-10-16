import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { PayeesScreen } from "@/components/payees/payees-screen";

export default function Page() { return <AuthenticatedPage><PayeesScreen /></AuthenticatedPage>; }
