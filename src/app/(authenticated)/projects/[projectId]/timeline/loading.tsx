import { Skeleton } from "@/components/ui/skeleton";
import { TimelineWorkspaceSkeleton } from "@/features/timeline-items/timeline-loading-skeleton";

export default function TimelineLoading() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-[70vw]" />
        </div>
        <Skeleton className="h-9 w-32" />
      </header>
      <TimelineWorkspaceSkeleton />
    </div>
  );
}
