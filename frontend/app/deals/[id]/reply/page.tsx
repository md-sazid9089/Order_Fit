import { Suspense } from "react";

interface DealReplyPageProps {
  params: Promise<{ id: string }>;
}

async function ReplyContent({ params }: DealReplyPageProps) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Counterparty Reply: Deal {id}</h1>
    </main>
  );
}

export default function DealReplyPage({ params }: DealReplyPageProps) {
  return (
    <Suspense fallback={<div className="p-8">Loading reply...</div>}>
      <ReplyContent params={params} />
    </Suspense>
  );
}
