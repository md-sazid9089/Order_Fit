import { Suspense } from "react";

interface DealConfirmPageProps {
  params: Promise<{ id: string }>;
}

async function ConfirmContent({ params }: DealConfirmPageProps) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Confirm Figures: Deal {id}</h1>
    </main>
  );
}

export default function DealConfirmPage({ params }: DealConfirmPageProps) {
  return (
    <Suspense fallback={<div className="p-8">Loading confirmation...</div>}>
      <ConfirmContent params={params} />
    </Suspense>
  );
}
