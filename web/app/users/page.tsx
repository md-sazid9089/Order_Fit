import { AuthenticatedPage } from "@/components/layout/authenticated-page";
import { UsersScreen } from "@/components/users/users-screen";

export default function Page() { return <AuthenticatedPage><UsersScreen /></AuthenticatedPage>; }
