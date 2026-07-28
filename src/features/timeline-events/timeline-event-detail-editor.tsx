"use client";

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
  return (
    <TimelineEventForm
      currentDate={{ year: currentYear, month: 1, day: 1 }}
      event={event}
      projectId={projectId}
      rangeItems={rangeItems}
      onDirtyChange={onDirtyChange}
      onSaved={onSaved}
    />
  );
}
