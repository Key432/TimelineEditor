"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/features/markdown/markdown";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { EntityHistoryDialog } from "@/features/history/entity-history-dialog";
import {
  formatApproximateHistoricalDate,
  formatHistoricalDate,
} from "@/features/timeline-items/historical-date";
import { TimelineItemEventList } from "@/features/timeline-items/timeline-item-event-list";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  getTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";
import type { TimelineItem } from "@/features/timeline-items/types";

function dateLabel(item: TimelineItem) {
  if (item.temporalType === "point") {
    return formatApproximateHistoricalDate(item.point, item.isPointApproximate);
  }
  const end =
    item.endDateStatus === "ongoing"
      ? "継続中"
      : item.endDateStatus === "unknown"
        ? `終了時期不明${item.lastConfirmed ? `（最終確認 ${formatHistoricalDate(item.lastConfirmed)}）` : ""}`
        : formatApproximateHistoricalDate(item.end, item.isEndApproximate);
  return `${formatApproximateHistoricalDate(item.start, item.isStartApproximate)} — ${end}`;
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
  closeOverlayAfterDelete = false,
  internalLinkBasePath,
}: {
  projectId: string;
  item: TimelineItem;
  events: TimelineEventSummary[];
  readOnly?: boolean;
  eventBasePath?: string;
  hardEventNavigation?: boolean;
  closeOverlayAfterDelete?: boolean;
  internalLinkBasePath?: string;
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
          <dt className="text-muted-foreground">別名</dt>
          <dd>
            {currentItem.aliases.length ? currentItem.aliases.join("、") : "—"}
          </dd>
        </dl>
      </header>
      <Separator />
      <section className="min-h-28 text-base leading-7">
        <MarkdownRenderer
          internalLinkBasePath={internalLinkBasePath}
          projectId={projectId}
          value={currentItem.description}
        />
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
        <>
          <EntityHistoryDialog
            entityId={currentItem.id}
            entityType="timeline_item"
            projectId={projectId}
            triggerPlacement="detail-options"
          />
          <DeleteTimelineItemDialog
            closeOverlayAfterDelete={closeOverlayAfterDelete}
            redirectAfterDelete
            itemId={currentItem.id}
            projectId={projectId}
            title={currentItem.title}
            triggerPlacement="detail-options"
          />
        </>
      ) : null}
    </article>
  );
}
