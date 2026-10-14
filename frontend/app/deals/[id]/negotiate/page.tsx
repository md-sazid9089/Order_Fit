import { Suspense } from "react";

interface DealNegotiatePageProps {
  params: Promise<{ id: string }>;
}

async function NegotiateContent({ params }: DealNegotiatePageProps) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Negotiate & Approve: Deal {id}</h1>
    </main>
  );
}

export default function DealNegotiatePage({ params }: DealNegotiatePageProps) {
  return (
    <Suspense fallback={<div className="p-8">Loading negotiation...</div>}>
      <NegotiateContent params={params} />
    </Suspense>
  );
}
