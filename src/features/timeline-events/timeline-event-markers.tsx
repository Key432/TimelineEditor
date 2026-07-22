"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  return `${event.isApproximate ? "約 " : ""}${formatHistoricalDate(event.date)}`;
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
  onOpenEvent,
}: {
  events: TimelineEventSummary[];
  domainStart: number;
  pixelsPerDay: number;
  visibleStart: number;
  visibleEnd: number;
  horizontalPadding: number;
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>イベントアイテムを選択</DialogTitle>
            <DialogDescription>
              重なっているイベントから詳細を表示する項目を選びます。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {(selectedCluster ?? []).map((event) => (
              <button
                key={event.id}
                className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                type="button"
                onClick={() => openEvent(event.id, false)}
              >
                <span className="min-w-0 truncate font-medium">
                  {event.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {eventDateLabel(event)}
                </span>
              </button>
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
}: {
  marker: EventMarker;
  onCancelOpen: () => void;
  onOpen: (eventId: string) => void;
  onOpenEdit: (eventId: string) => void;
}) {
  return (
    <TimelineEntityTooltip
      date={eventDateLabel(marker.event)}
      title={marker.event.title}
    >
      <button
        aria-label={`イベントアイテム ${marker.event.title} ${formatHistoricalDate(marker.event.date)}`}
        className="focus-visible:ring-focus absolute top-1/2 z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-secondary shadow-sm transition-[box-shadow,transform] hover:scale-125 hover:shadow-[0_0_0_3px_rgba(255,51,153,0.25)] focus-visible:scale-125 focus-visible:ring-2 focus-visible:outline-none"
        data-timeline-event-marker="true"
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
}: {
  group: TimelineMarkerGroup<TimelineEventSummary>;
  onSelect: (events: TimelineEventSummary[]) => void;
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
          className="absolute top-1/2 z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-secondary text-[10px] font-bold text-secondary-foreground shadow-sm transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:outline-none"
          data-timeline-event-marker="true"
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
