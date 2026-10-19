import { Suspense } from "react";
import { DealConfirmClient } from "@/components/deals/deal-confirm-client";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string }> };

async function ConfirmContent({ params }: Props) {
  const { id } = await params;
  return <DealConfirmClient id={id} />;
}

export default function DealConfirmPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8 text-xs text-[#737373]">Loading confirmation gate...</main>}>
      <ConfirmContent {...props} />
    </Suspense>
  );
}
