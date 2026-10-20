import { PageFrame, panel } from "@/components/p7/common";
import { SkeletonTable, Skeleton } from "@/components/ui/skeleton";

export default function CashFlowLoading() {
  return (
    <PageFrame
      title="Cash Flow Baseline"
      intro="Opening cash and dated baseline events saved for this business."
    >
      <section className={panel} role="status" aria-busy="true">
        <span className="sr-only">Loading cash flow baseline…</span>
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-3.5 w-full max-w-xl" />
        <div className="pt-2">
          <SkeletonTable rows={5} columns={4} />
        </div>
      </section>
    </PageFrame>
  );
}
