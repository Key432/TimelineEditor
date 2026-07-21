"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  listTimelineEvents,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import { TimelineEventForm } from "@/features/timeline-events/timeline-event-form";
import { formatHistoricalDate } from "@/features/timeline-items/historical-date";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";

export function TimelineEventSection({
  projectId,
  parentId,
  rangeItems,
  currentDate,
}: {
  projectId: string;
  parentId: string;
  rangeItems: TimelineItemSummary[];
  currentDate: HistoricalDate;
}) {
  const [adding, setAdding] = useState(false);
  const { data: events = [] } = useQuery({
    queryKey: timelineEventKeys.list(projectId),
    queryFn: () => listTimelineEvents(projectId),
  });
  const children = events.filter((event) => event.timelineItemId === parentId);

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">子イベント（{children.length}件）</h3>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => setAdding((value) => !value)}
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          子イベントを追加
        </Button>
      </div>
      {adding ? (
        <TimelineEventForm
          currentDate={currentDate}
          initialParentId={parentId}
          projectId={projectId}
          rangeItems={rangeItems}
          onSaved={() => setAdding(false)}
        />
      ) : null}
      {children.length ? (
        <ul className="divide-y rounded-md border">
          {children.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-muted-foreground">
                  {event.isApproximate ? "約 " : ""}
                  {formatHistoricalDate(event.date)}
                </p>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/projects/${projectId}/events/${event.id}`}>
                  詳細
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : !adding ? (
        <p className="text-sm text-muted-foreground">
          子イベントはまだありません。
        </p>
      ) : null}
    </section>
  );
}
