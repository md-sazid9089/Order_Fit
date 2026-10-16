import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { SettingsScreen } from "@/components/settings/settings-screen";

export default function Page() { return <AuthenticatedPage><SettingsScreen /></AuthenticatedPage>; }
