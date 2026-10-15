import { Suspense } from "react";
import Link from "next/link";
import { DealReplyClient } from "@/components/deals/deal-reply-client";

interface DealReplyPageProps {
  params: Promise<{ id: string }>;
}

async function ReplyContent({ params }: DealReplyPageProps) {
  const { id } = await params;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return <main className="space-y-3 p-8"><h1 className="text-xl font-semibold">Reply reassessment is unavailable</h1><p>This workflow requires P5. Saved manual order reviews and financial results are available from your orders.</p><Link className="underline" href="/deals">Saved orders</Link></main>;
  return <DealReplyClient id={id} />;
}

export default function DealReplyPage({ params }: DealReplyPageProps) {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading reply re-planning...</div>}>
      <ReplyContent params={params} />
    </Suspense>
  );
}
