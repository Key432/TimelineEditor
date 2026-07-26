"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { formatHistoricalDate } from "@/features/timeline-items/historical-date";
import { TimelineItemEventList } from "@/features/timeline-items/timeline-item-event-list";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  getTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";
import type { TimelineItem } from "@/features/timeline-items/types";

function dateLabel(item: TimelineItem) {
  if (item.temporalType === "point") {
    return `${item.isPointApproximate ? "約 " : ""}${formatHistoricalDate(item.point)}`;
  }
  const end =
    item.endDateStatus === "ongoing"
      ? "継続中"
      : item.endDateStatus === "unknown"
        ? `終了時期不明${item.lastConfirmed ? `（最終確認 ${formatHistoricalDate(item.lastConfirmed)}）` : ""}`
        : `${item.isEndApproximate ? "約 " : ""}${formatHistoricalDate(item.end)}`;
  return `${item.isStartApproximate ? "約 " : ""}${formatHistoricalDate(item.start)} — ${end}`;
}

function PlainText({ value }: { value: string | null }) {
  return value ? (
    <p className="whitespace-pre-wrap">{value}</p>
  ) : (
    <p className="text-muted-foreground">—</p>
  );
}

function SourceText({ value }: { value: string | null }) {
  if (!value) return <p className="text-muted-foreground">—</p>;
  return (
    <p className="whitespace-pre-wrap">
      {value.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
        if (!part.startsWith("http://") && !part.startsWith("https://")) {
          return part;
        }
        try {
          const url = new URL(part);
          return (
            <a
              key={`${url.href}-${index}`}
              className="text-primary underline underline-offset-4"
              href={url.href}
              rel="noreferrer"
              target="_blank"
            >
              {part}
            </a>
          );
        } catch {
          return part;
        }
      })}
    </p>
  );
}

export function TimelineItemDetail({
  projectId,
  item,
  events,
  readOnly = false,
  eventBasePath,
  hardEventNavigation = false,
}: {
  projectId: string;
  item: TimelineItem;
  events: TimelineEventSummary[];
  readOnly?: boolean;
  eventBasePath?: string;
  hardEventNavigation?: boolean;
}) {
  const { data: currentItem } = useQuery({
    queryKey: timelineItemKeys.detail(projectId, item.id),
    queryFn: () => getTimelineItem(projectId, item.id),
    initialData: item,
    enabled: !readOnly,
  });

  return (
    <article className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
      <header className="space-y-5 pr-8">
        <Badge variant="outline">タイムラインアイテム</Badge>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {currentItem.title}
        </h1>
        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">対象種別</dt>
          <dd>{currentItem.itemType.name}</dd>
          <dt className="text-muted-foreground">時間形式</dt>
          <dd>{currentItem.temporalType === "range" ? "期間" : "時点"}</dd>
          <dt className="text-muted-foreground">登録日付</dt>
          <dd>{dateLabel(currentItem)}</dd>
          <dt className="text-muted-foreground">イベント</dt>
          <dd>
            <TimelineItemEventList
              basePath={eventBasePath}
              events={events}
              hardNavigation={hardEventNavigation}
              projectId={projectId}
            />
          </dd>
        </dl>
      </header>
      <Separator />
      <section className="min-h-28 text-base leading-7">
        <PlainText value={currentItem.description} />
      </section>
      <Separator />
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          出典・参考文献
        </h2>
        <SourceText value={currentItem.sourceText} />
      </section>
      {currentItem.externalUrl ? (
        <p>
          <a
            className="text-primary underline underline-offset-4"
            href={currentItem.externalUrl}
            rel="noreferrer"
            target="_blank"
          >
            外部URLを開く
          </a>
        </p>
      ) : null}
      {!readOnly ? (
        <div className="flex flex-wrap gap-2 border-t pt-6">
          <Button asChild>
            <Link href={`/projects/${projectId}/items/${currentItem.id}/edit`}>
              <Pencil aria-hidden="true" className="size-4" />
              編集
            </Link>
          </Button>
          <DeleteTimelineItemDialog
            childEventCount={events.length}
            redirectAfterDelete
            itemId={currentItem.id}
            projectId={projectId}
            title={currentItem.title}
          />
        </div>
      ) : null}
    </article>
  );
}
