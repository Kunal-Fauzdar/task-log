import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-6 w-40" />
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-6 w-28" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
