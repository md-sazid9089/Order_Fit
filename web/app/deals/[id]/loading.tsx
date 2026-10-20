import { DealDetailSkeleton } from "@/components/ui/skeleton";

export default function DealDetailLoading() {
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <DealDetailSkeleton />
    </main>
  );
}
