import { PageFrame, panel } from "@/components/p7/common";
import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function FinancingLoading() {
  return (
    <PageFrame
      title="Financing Offers"
      intro="Active and proposed term-loan facilities available for this business."
    >
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading financing offers…</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <section className={panel}>
          <Skeleton className="h-5 w-40" />
          <SkeletonCard />
        </section>
      </div>
    </PageFrame>
  );
}
