import { SkeletonAdminPlatform } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-neutral-100 font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900 antialiased">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="px-3.5 sm:px-6 lg:px-8 pt-14 lg:pt-6 pb-6 w-full min-w-0">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full min-w-0">
            <SkeletonAdminPlatform section="overview" />
          </div>
        </main>
      </div>
    </div>
  );
}
