import { SkeletonOverview } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1560px] mx-auto w-full">
        <SkeletonOverview />
      </div>
    </main>
  );
}
