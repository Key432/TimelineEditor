"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  clusterTimelineMarkers,
  type TimelineMarkerGroup,
} from "@/features/timeline-events/clustering";
import { eventX } from "@/features/timeline-events/snap";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  formatApproximateHistoricalDate,
  formatHistoricalDate,
  historicalDateOrdinal,
} from "@/features/timeline-items/historical-date";
import { TimelineEntityTooltip } from "@/features/timeline-items/timeline-entity-tooltip";
import { overlapsViewport } from "@/features/timeline-items/timeline-math";

type EventMarker = {
  event: TimelineEventSummary;
  x: number;
};

function eventDateLabel(event: TimelineEventSummary) {
  return formatApproximateHistoricalDate(event.date, event.isApproximate);
}

function sortEvents(left: TimelineEventSummary, right: TimelineEventSummary) {
  return (
    historicalDateOrdinal(left.date) - historicalDateOrdinal(right.date) ||
    left.title.localeCompare(right.title, "ja")
  );
}

export function TimelineEventMarkers({
  events,
  domainStart,
  pixelsPerDay,
  visibleStart,
  visibleEnd,
  horizontalPadding,
  highlightedEventIds,
  onOpenEvent,
}: {
  events: TimelineEventSummary[];
  domainStart: number;
  pixelsPerDay: number;
  visibleStart: number;
  visibleEnd: number;
  horizontalPadding: number;
  highlightedEventIds?: ReadonlySet<string>;
  onOpenEvent: (eventId: string, editing: boolean) => void;
}) {
  const openTimerRef = useRef<number | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<
    TimelineEventSummary[] | null
  >(null);
  const groups = useMemo(
    () =>
      clusterTimelineMarkers(
        events
          .map((event) => ({
            x:
              horizontalPadding + eventX(event.date, domainStart, pixelsPerDay),
            value: event,
          }))
          .filter((marker) =>
            overlapsViewport(marker.x, marker.x, visibleStart, visibleEnd),
          ),
      ),
    [
      domainStart,
      events,
      horizontalPadding,
      pixelsPerDay,
      visibleEnd,
      visibleStart,
    ],
  );

  useEffect(
    () => () => {
      if (openTimerRef.current !== null)
        window.clearTimeout(openTimerRef.current);
    },
    [],
  );

  function cancelOpen() {
    if (openTimerRef.current !== null)
      window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }

  function openEvent(eventId: string, editing: boolean) {
    cancelOpen();
    setSelectedCluster(null);
    onOpenEvent(eventId, editing);
  }

  return (
    <>
      {groups.map((group) =>
        group.markers.length === 1 ? (
          <SingleEventMarker
            key={group.markers[0]!.value.id}
            marker={{ event: group.markers[0]!.value, x: group.x }}
            highlighted={
              highlightedEventIds?.has(group.markers[0]!.value.id) ?? false
            }
            onCancelOpen={cancelOpen}
            onOpen={(eventId) => {
              cancelOpen();
              openTimerRef.current = window.setTimeout(
                () => openEvent(eventId, false),
                250,
              );
            }}
            onOpenEdit={(eventId) => openEvent(eventId, true)}
          />
        ) : (
          <EventClusterMarker
            key={group.markers.map((marker) => marker.value.id).join(":")}
            group={group}
            highlighted={group.markers.some((marker) =>
              highlightedEventIds?.has(marker.value.id),
            )}
            onSelect={setSelectedCluster}
          />
        ),
      )}

      <Dialog
        open={selectedCluster !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCluster(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>イベントを選択</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto rounded-lg border bg-card">
            {(selectedCluster ?? []).map((event) => (
              <Button
                key={event.id}
                className="group h-auto w-full cursor-pointer justify-start rounded-none border-b border-l-2 border-l-transparent px-3 py-3 text-left last:border-b-0 hover:border-l-primary hover:bg-primary/20 hover:text-foreground focus-visible:border-l-primary focus-visible:bg-primary/20 focus-visible:ring-2 focus-visible:ring-inset"
                type="button"
                variant="ghost"
                onClick={() => openEvent(event.id, false)}
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                  <span className="min-w-0 truncate font-medium">
                    {event.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground">
                    {eventDateLabel(event)}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary group-focus-visible:translate-x-0.5 group-focus-visible:text-primary"
                    />
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SingleEventMarker({
  marker,
  onCancelOpen,
  onOpen,
  onOpenEdit,
  highlighted,
}: {
  marker: EventMarker;
  onCancelOpen: () => void;
  onOpen: (eventId: string) => void;
  onOpenEdit: (eventId: string) => void;
  highlighted: boolean;
}) {
  return (
    <TimelineEntityTooltip
      date={eventDateLabel(marker.event)}
      title={marker.event.title}
    >
      <button
        aria-label={`イベントアイテム ${marker.event.title} ${formatHistoricalDate(marker.event.date)}`}
        className={`focus-visible:ring-focus absolute top-1/2 z-30 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-secondary shadow-sm transition-[box-shadow,transform] hover:z-40 hover:scale-125 hover:ring-2 hover:ring-secondary hover:ring-offset-2 hover:ring-offset-background focus-visible:z-40 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none data-[pointer-overlap=true]:z-40 data-[pointer-overlap=true]:scale-125 data-[pointer-overlap=true]:ring-4 data-[pointer-overlap=true]:ring-primary ${highlighted ? "ring-4 ring-secondary ring-offset-2 ring-offset-background" : ""}`}
        data-timeline-event-marker="true"
        data-search-match={highlighted ? "true" : undefined}
        style={{ left: marker.x }}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(marker.event.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onCancelOpen();
          onOpenEdit(marker.event.id);
        }}
      />
    </TimelineEntityTooltip>
  );
}

function EventClusterMarker({
  group,
  onSelect,
  highlighted,
}: {
  group: TimelineMarkerGroup<TimelineEventSummary>;
  onSelect: (events: TimelineEventSummary[]) => void;
  highlighted: boolean;
}) {
  const events = useMemo(
    () => group.markers.map((marker) => marker.value).sort(sortEvents),
    [group.markers],
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={`${events.length}件のイベントアイテムを選択`}
          className={`absolute top-1/2 z-30 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-secondary text-[10px] font-bold text-secondary-foreground shadow-sm transition-[box-shadow,transform] hover:z-40 hover:scale-110 hover:ring-2 hover:ring-secondary hover:ring-offset-2 hover:ring-offset-background focus-visible:z-40 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none data-[pointer-overlap=true]:z-40 data-[pointer-overlap=true]:scale-110 data-[pointer-overlap=true]:ring-4 data-[pointer-overlap=true]:ring-primary ${highlighted ? "ring-4 ring-secondary ring-offset-2 ring-offset-background" : ""}`}
          data-timeline-event-marker="true"
          data-search-match={highlighted ? "true" : undefined}
          data-testid="timeline-event-cluster"
          style={{ left: group.x }}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(events);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {events.length}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-h-64 w-72 overflow-y-auto p-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          {events.length}件のイベント
        </p>
        <ul className="space-y-1">
          {events.map((event) => (
            <li key={event.id} className="rounded-md px-2 py-1.5">
              <p className="truncate text-sm font-medium">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {eventDateLabel(event)}
              </p>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
