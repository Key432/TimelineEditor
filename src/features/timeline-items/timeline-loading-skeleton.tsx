import { Skeleton } from "@/components/ui/skeleton";

export function TimelineWorkspaceSkeleton({
  label = "タイムラインを読み込み中",
}: {
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      className="flex min-h-[32rem] flex-1 flex-col gap-3 rounded-xl border bg-card p-4"
      role="status"
    >
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="ml-auto h-6 w-20" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(10rem,15rem)_1fr] overflow-hidden rounded-lg border">
        <div className="space-y-3 border-r p-3">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
        <div className="relative bg-muted/25 p-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton
              key={index}
              className="mt-3 h-12"
              style={{ width: `${68 + (index % 3) * 10}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimelinePanelSkeleton() {
  return (
    <div aria-label="パネルを読み込み中" className="space-y-4" role="status">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
