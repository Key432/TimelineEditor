"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  historyKeys,
  listTrash,
  purgeTrashEntry,
  restoreTrashEntry,
} from "@/features/history/api";
import type { TrashEntry } from "@/features/history/types";
import { timelineEventKeys } from "@/features/timeline-events/api";
import { timelineItemKeys } from "@/features/timeline-items/api";
import { cn } from "@/lib/utils";

const TRASH_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TrashManager({
  projectId,
  separated = true,
}: {
  projectId: string;
  separated?: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const key = historyKeys.trash(projectId);
  const trash = useQuery({
    queryKey: key,
    queryFn: () => listTrash(projectId),
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({
        queryKey: timelineItemKeys.list(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: timelineEventKeys.list(projectId),
      }),
    ]);
    router.refresh();
  }

  const restore = useMutation({
    mutationFn: (entry: TrashEntry) =>
      restoreTrashEntry(projectId, entry.entityType, entry.entityId),
    onSuccess: refresh,
  });
  const purge = useMutation({
    mutationFn: (entry: TrashEntry) =>
      purgeTrashEntry(projectId, entry.entityType, entry.entityId),
    onSuccess: refresh,
  });
  const error = trash.error ?? restore.error ?? purge.error;

  return (
    <section className={cn("space-y-3", separated && "border-t pt-6")}>
      <div>
        <h2 className="font-medium">ゴミ箱</h2>
        <p className="text-sm text-muted-foreground">
          削除したアイテムとイベントを復元できます。
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      {trash.isLoading ? (
        <p className="text-sm text-muted-foreground">
          ゴミ箱を読み込んでいます…
        </p>
      ) : null}
      {trash.data?.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          ゴミ箱は空です。
        </p>
      ) : null}
      <ul className="space-y-2">
        {trash.data?.map((entry) => (
          <li
            key={`${entry.entityType}-${entry.entityId}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{entry.title}</p>
              <p className="text-xs text-muted-foreground">
                {entry.entityType === "timeline_item"
                  ? "タイムラインアイテム"
                  : "イベントアイテム"}
                {" · "}
                {TRASH_DATE_FORMATTER.format(new Date(entry.deletedAt))}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={restore.isPending || purge.isPending}
                onClick={() => restore.mutate(entry)}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                復元
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={restore.isPending || purge.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `「${entry.title}」を完全に削除しますか？この操作は取り消せません。`,
                    )
                  )
                    purge.mutate(entry);
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                完全削除
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
