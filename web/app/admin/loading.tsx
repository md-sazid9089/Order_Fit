import { SkeletonAdminPlatform } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen flex bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <main className="flex-1 min-w-0 p-4 pt-16 sm:p-8 space-y-6">
        <SkeletonAdminPlatform section="overview" />
      </main>
    </div>
  );
}
