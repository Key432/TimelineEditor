"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getTimelineEvent,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import { TimelineEventForm } from "@/features/timeline-events/timeline-event-form";
import type { TimelineEvent } from "@/features/timeline-events/types";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import { useDetailEditorActions } from "@/features/timeline-items/detail-editor-context";

export function TimelineEventDetailEditor({
  projectId,
  event,
  rangeItems,
  currentYear,
}: {
  projectId: string;
  event: TimelineEvent;
  rangeItems: TimelineItemSummary[];
  currentYear: number;
}) {
  const { onDirtyChange, onSaved } = useDetailEditorActions();
  const { data: currentEvent } = useQuery({
    queryKey: timelineEventKeys.detail(projectId, event.id),
    queryFn: () => getTimelineEvent(projectId, event.id),
    initialData: event,
  });
  return (
    <TimelineEventForm
      currentDate={{ year: currentYear, month: 1, day: 1 }}
      event={currentEvent}
      projectId={projectId}
      rangeItems={rangeItems}
      onDirtyChange={onDirtyChange}
      onSaved={onSaved}
    />
  );
}
