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
import { SourceDisplay } from "@/features/sources/source-display";
import { EntityMetadataDisplay } from "@/features/classification/entity-metadata-display";
import { RelationshipManager } from "@/features/relationships/relationship-manager";

export function TimelineEventDetail({
  projectId,
  event,
  readOnly = false,
  closeOverlayAfterDelete = false,
  internalLinkBasePath,
}: {
  projectId: string;
  event: TimelineEvent;
  readOnly?: boolean;
  closeOverlayAfterDelete?: boolean;
  internalLinkBasePath?: string;
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
          <dd>
            {currentEvent.parents.map((parent) => parent.title).join("、")}
          </dd>
          <dt className="text-muted-foreground">別名</dt>
          <dd>
            {currentEvent.aliases.length
              ? currentEvent.aliases.join("、")
              : "—"}
          </dd>
          <EntityMetadataDisplay
            projectId={projectId}
            tags={currentEvent.tags}
            eventType={currentEvent.eventType}
            customFields={currentEvent.customFields}
          />
        </dl>
      </header>
      <Separator />
      <section className="min-h-28 text-base leading-7">
        <MarkdownRenderer
          citations={currentEvent.citations}
          internalLinkBasePath={internalLinkBasePath}
          projectId={projectId}
          value={currentEvent.description}
        />
      </section>
      <Separator />
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          出典・参考文献
        </h2>
        <SourceDisplay
          citations={currentEvent.citations}
          projectId={projectId}
          readOnly={readOnly}
          sourceText={currentEvent.sourceText}
        />
      </section>
      <Separator />
      <RelationshipManager
        basePath={internalLinkBasePath}
        entity={{ type: "timeline_event", id: currentEvent.id }}
        projectId={projectId}
        readOnly
      />
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
