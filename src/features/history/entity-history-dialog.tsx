"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, History, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createCheckpoint,
  historyKeys,
  listEntityHistory,
  restoreHistory,
} from "@/features/history/api";
import { createLineDiff } from "@/features/history/line-diff";
import type {
  EntityHistoryChange,
  HistoryEntityType,
} from "@/features/history/types";
import { timelineEventKeys } from "@/features/timeline-events/api";
import { timelineItemKeys } from "@/features/timeline-items/api";
import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  title: "タイトル",
  type_id: "対象種別",
  description: "本文",
  source_text: "出典・参考文献",
  external_url: "外部URL",
  temporal_type: "時間形式",
  color_override: "個別色",
  is_visible: "表示状態",
  start_year: "開始年",
  start_month: "開始月",
  start_day: "開始日",
  start_era: "開始紀元",
  start_precision: "開始精度",
  start_original_text: "開始日の原表記",
  is_start_approximate: "開始日のおおよそ",
  end_date_status: "終了状態",
  end_year: "終了年",
  end_month: "終了月",
  end_day: "終了日",
  end_era: "終了紀元",
  end_precision: "終了精度",
  end_original_text: "終了日の原表記",
  is_end_approximate: "終了日のおおよそ",
  is_point_approximate: "時点日のおおよそ",
  timeline_item_id: "親タイムライン",
  event_year: "年",
  event_month: "月",
  event_day: "日",
  event_era: "紀元",
  event_precision: "日付精度",
  event_original_text: "日付の原表記",
  is_approximate: "おおよそ",
};

const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

function valueText(value: Json | undefined) {
  if (value === undefined || value === null || value === "") return "（空）";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  return JSON.stringify(value, null, 2);
}

function FieldDiff({
  field,
  change,
}: {
  field: string;
  change: EntityHistoryChange;
}) {
  const lines = createLineDiff(
    valueText(change.before),
    valueText(change.after),
  );
  return (
    <section className="overflow-hidden rounded-md border">
      <h4 className="bg-muted px-3 py-2 text-xs font-medium">
        {FIELD_LABELS[field] ?? field}
      </h4>
      <div
        className="overflow-x-auto font-mono text-xs"
        role="region"
        aria-label={`${FIELD_LABELS[field] ?? field}の差分`}
      >
        {lines.map((line, index) => (
          <div
            key={`${line.kind}-${index}`}
            className={cn(
              "grid grid-cols-[2rem_1fr] whitespace-pre-wrap",
              line.kind === "removed" && "bg-red-50 text-red-950",
              line.kind === "added" && "bg-emerald-50 text-emerald-950",
            )}
          >
            <span
              className="border-r px-2 py-1 text-center text-muted-foreground select-none"
              aria-hidden="true"
            >
              {line.kind === "removed"
                ? "−"
                : line.kind === "added"
                  ? "+"
                  : " "}
            </span>
            <span className="px-2 py-1">{line.value || " "}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EntityHistoryDialog({
  projectId,
  entityType,
  entityId,
}: {
  projectId: string;
  entityType: HistoryEntityType;
  entityId: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const key = historyKeys.entity(projectId, entityType, entityId);
  const history = useQuery({
    queryKey: key,
    queryFn: () => listEntityHistory(projectId, entityType, entityId),
    enabled: open,
  });
  const checkpoint = useMutation({
    mutationFn: () => createCheckpoint(projectId, entityType, entityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const restore = useMutation({
    mutationFn: (historyId: string) => restoreHistory(projectId, historyId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({
          queryKey: timelineItemKeys.list(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: timelineEventKeys.list(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey:
            entityType === "timeline_item"
              ? timelineItemKeys.detail(projectId, entityId)
              : timelineEventKeys.detail(projectId, entityId),
        }),
      ]);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <History aria-hidden="true" className="size-4" />
          変更履歴
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>変更履歴</DialogTitle>
          <DialogDescription>
            保存ごとの変更箇所を比較し、選択した版へ復元できます。
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={checkpoint.isPending}
            onClick={() => checkpoint.mutate()}
          >
            <BookmarkPlus aria-hidden="true" className="size-4" />
            {checkpoint.isPending ? "作成中…" : "チェックポイントを作成"}
          </Button>
        </div>
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">
            履歴を読み込んでいます…
          </p>
        ) : null}
        {history.error || checkpoint.error || restore.error ? (
          <p role="alert" className="text-sm text-destructive">
            {(history.error ?? checkpoint.error ?? restore.error)?.message}
          </p>
        ) : null}
        {history.data?.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            まだ変更履歴はありません。
          </p>
        ) : null}
        <div className="space-y-3">
          {history.data?.map((entry) => (
            <details
              key={entry.id}
              className="group rounded-lg border"
              open={entry === history.data[0]}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-sm font-medium">
                    {entry.isCheckpoint
                      ? "手動チェックポイント"
                      : entry.operation === "restore"
                        ? "履歴から復元"
                        : `${Object.keys(entry.changes).length}項目を変更`}
                  </span>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={entry.createdAt}
                  >
                    {HISTORY_DATE_FORMATTER.format(new Date(entry.createdAt))}
                  </time>
                </span>
                <span className="text-xs text-muted-foreground">
                  版 {entry.revision}
                </span>
              </summary>
              <div className="space-y-3 border-t p-4">
                {Object.entries(entry.changes).map(([field, change]) => (
                  <FieldDiff key={field} field={field} change={change} />
                ))}
                {Object.keys(entry.changes).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    この時点の内容を記録したチェックポイントです。
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restore.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "この版の内容へ復元しますか？現在の内容も新しい履歴として残ります。",
                        )
                      ) {
                        restore.mutate(entry.id);
                      }
                    }}
                  >
                    <RotateCcw aria-hidden="true" className="size-4" />
                    この版へ復元
                  </Button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
