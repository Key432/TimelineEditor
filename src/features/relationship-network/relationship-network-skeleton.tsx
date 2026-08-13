import { Skeleton } from "@/components/ui/skeleton";

export function RelationshipNetworkSkeleton() {
  return (
    <div
      aria-label="関連ネットワークを読み込み中"
      className="flex min-h-[32rem] flex-1 flex-col gap-3 rounded-xl border bg-card p-4"
      role="status"
    >
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="relative flex-1 overflow-hidden rounded-lg bg-muted/40">
        <Skeleton className="absolute top-16 left-[12%] h-14 w-44 rounded-lg" />
        <Skeleton className="absolute top-40 left-[44%] h-14 w-44 rounded-lg" />
        <Skeleton className="absolute top-24 right-[10%] h-14 w-44 rounded-lg" />
        <Skeleton className="absolute bottom-20 left-[28%] h-14 w-44 rounded-lg" />
      </div>
    </div>
  );
}
