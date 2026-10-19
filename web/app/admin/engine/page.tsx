import { redirect } from "next/navigation";

// The engine has no platform settings to show or change; how it is governed is described on the security page.
export default function AdminEnginePage() {
  redirect("/admin/security");
}
