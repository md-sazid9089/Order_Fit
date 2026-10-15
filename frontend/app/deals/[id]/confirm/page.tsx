import { Suspense } from "react";
import { DealConfirmClient } from "@/components/deals/deal-confirm-client";

interface DealConfirmPageProps {
  params: Promise<{ id: string }>;
}

async function ConfirmContent({ params }: DealConfirmPageProps) {
  const { id } = await params;
  return <DealConfirmClient id={id} />;
}

export default function DealConfirmPage({ params }: DealConfirmPageProps) {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading confirmation...</div>}>
      <ConfirmContent params={params} />
    </Suspense>
  );
}
