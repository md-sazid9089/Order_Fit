import { Suspense } from "react";
import { DealReplyClient } from "@/components/deals/deal-reply-client";

interface DealReplyPageProps {
  params: Promise<{ id: string }>;
}

async function ReplyContent({ params }: DealReplyPageProps) {
  const { id } = await params;
  return <DealReplyClient id={id} />;
}

export default function DealReplyPage({ params }: DealReplyPageProps) {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading reply re-planning...</div>}>
      <ReplyContent params={params} />
    </Suspense>
  );
}
