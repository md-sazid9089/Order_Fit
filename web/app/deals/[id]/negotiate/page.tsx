import { Suspense } from "react";
import { PreparationWorkspace } from "@/components/preparation-workspace";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string; operationId?: string }> };
async function PreparationContent({ params, searchParams }: Props) {
  const [p, q] = await Promise.all([params, searchParams]);
  return <PreparationWorkspace key={`${p.id}:${q.businessId}`} dealId={p.id} businessId={q.businessId} operationId={q.operationId} />;
}
export default function PreparationPage(props: Props) {
  return <Suspense fallback={<main className="p-8">Loading saved preparation…</main>}><PreparationContent {...props} /></Suspense>;
}
