import { SkeletonDashboard } from "@/components/ui/skeleton";

export default function DealsLoading() {
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1440px] mx-auto w-full">
        <SkeletonDashboard />
      </div>
    </main>
  );
}
