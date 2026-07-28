"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/features/markdown/markdown";
import { DeleteTimelineEventDialog } from "@/features/timeline-events/delete-timeline-event-dialog";
import {
  getTimelineEvent,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import type { TimelineEvent } from "@/features/timeline-events/types";
import { formatApproximateHistoricalDate } from "@/features/timeline-items/historical-date";
import { EntityHistoryDialog } from "@/features/history/entity-history-dialog";

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
              className="text-primary underline"
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

export function TimelineEventDetail({
  projectId,
  event,
  readOnly = false,
  closeOverlayAfterDelete = false,
}: {
  projectId: string;
  event: TimelineEvent;
  readOnly?: boolean;
  closeOverlayAfterDelete?: boolean;
}) {
  const { data: currentEvent } = useQuery({
    queryKey: timelineEventKeys.detail(projectId, event.id),
    queryFn: () => getTimelineEvent(projectId, event.id),
    initialData: event,
    enabled: !readOnly,
  });
  return (
    <article className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
      <header className="space-y-5 pr-8">
        <Badge variant="outline">イベントアイテム</Badge>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {currentEvent.title}
        </h1>
        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">登録日付</dt>
          <dd>
            {formatApproximateHistoricalDate(
              currentEvent.date,
              currentEvent.isApproximate,
            )}
          </dd>
          <dt className="text-muted-foreground">タイムライン</dt>
          <dd>{currentEvent.parent.title}</dd>
        </dl>
      </header>
      <Separator />
      <section className="min-h-28 text-base leading-7">
        <MarkdownRenderer value={currentEvent.description} />
      </section>
      <Separator />
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          出典・参考文献
        </h2>
        <SourceText value={currentEvent.sourceText} />
      </section>
      {currentEvent.externalUrl ? (
        <p>
          <a
            className="text-primary underline"
            href={currentEvent.externalUrl}
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
            entityId={currentEvent.id}
            entityType="timeline_event"
            projectId={projectId}
            triggerPlacement="detail-options"
          />
          <DeleteTimelineEventDialog
            closeOverlayAfterDelete={closeOverlayAfterDelete}
            eventId={currentEvent.id}
            projectId={projectId}
            title={currentEvent.title}
          />
        </>
      ) : null}
    </article>
  );
}
