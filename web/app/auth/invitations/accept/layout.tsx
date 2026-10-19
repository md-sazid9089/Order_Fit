import type { Metadata } from "next";

// One-time links: keep them out of referrers and search indexes.
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default function TokenPageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
