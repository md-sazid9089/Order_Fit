import { Suspense } from "react";

interface DealPageProps {
  params: Promise<{ id: string }>;
}

async function DealContent({ params }: DealPageProps) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Deal Workspace: {id}</h1>
    </main>
  );
}

export default function DealPage({ params }: DealPageProps) {
  return (
    <Suspense fallback={<div className="p-8">Loading deal...</div>}>
      <DealContent params={params} />
    </Suspense>
  );
}
