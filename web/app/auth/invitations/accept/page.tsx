import type { Metadata } from "next";
import { AcceptInvitation } from "@/components/auth/accept-invitation";

// The invitation token travels in the URL fragment, which is never sent to any server. Keep referrers off this page.
export const metadata: Metadata = { title: "Accept invitation", robots: { index: false }, referrer: "no-referrer" };

export default function Page() { return <AcceptInvitation />; }
