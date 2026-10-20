import { PageFrame, panel } from "@/components/p7/common";
import { SkeletonCard, Skeleton, SkeletonButton } from "@/components/ui/skeleton";

export default function RiskConstraintsLoading() {
  return (
    <PageFrame
      title="Risk Constraints & Policies"
      intro="Liquidity reserve floors, stress scenario thresholds and financing eligibility rules."
    >
      <div role="status" aria-busy="true" className="space-y-5">
        <span className="sr-only">Loading risk constraints…</span>
        <section className={panel}>
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="pt-3 flex justify-end">
            <SkeletonButton size="md" />
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
