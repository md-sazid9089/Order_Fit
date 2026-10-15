import { Suspense } from "react";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string }> };
async function PersistedConfirmation({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const scope = query.businessId ? `?businessId=${encodeURIComponent(query.businessId)}` : "";
  redirect(`/deals/${encodeURIComponent(id)}${scope}`);
  return null;
}
export default function DealConfirmPage(props: Props) {
  return <Suspense fallback={<main className="p-8">Opening saved order review...</main>}><PersistedConfirmation {...props} /></Suspense>;
}
