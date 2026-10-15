import { Suspense } from "react";
import { DealDetailClient } from "@/components/deals/deal-detail-client";

interface DealPageProps {
  params: Promise<{ id: string }>;
}

async function DealContent({ params }: DealPageProps) {
  const { id } = await params;
  return <DealDetailClient id={id} />;
}

export default function DealPage({ params }: DealPageProps) {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading deal overview...</div>}>
      <DealContent params={params} />
    </Suspense>
  );
}
