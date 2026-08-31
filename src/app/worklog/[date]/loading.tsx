import { Skeleton } from "@/components/ui/skeleton";

export default function WorkLogDayLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}
