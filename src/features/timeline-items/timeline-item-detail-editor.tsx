"use client";

import { TimelineEventSection } from "@/features/timeline-events/timeline-event-section";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { TimelineItemForm } from "@/features/timeline-items/timeline-item-form";
import { useDetailEditorActions } from "@/features/timeline-items/detail-editor-context";
import type {
  TimelineItem,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import type { TimelineItemType } from "@/features/item-types/types";

export function TimelineItemDetailEditor({
  projectId,
  item,
  itemTypes,
  rangeItems,
  events,
  currentYear,
  closeOverlayAfterDelete = false,
}: {
  projectId: string;
  item: TimelineItem;
  itemTypes: TimelineItemType[];
  rangeItems: TimelineItemSummary[];
  events: TimelineEventSummary[];
  currentYear: number;
  closeOverlayAfterDelete?: boolean;
}) {
  const { onDirtyChange, onSaved } = useDetailEditorActions();
  return (
    <div className="space-y-6">
      <TimelineItemForm
        item={item}
        itemTypes={itemTypes}
        projectId={projectId}
        onDirtyChange={onDirtyChange}
        onSaved={onSaved}
      />
      {item.temporalType === "range" ? (
        <TimelineEventSection
          currentDate={{ year: currentYear, month: 1, day: 1 }}
          parentId={item.id}
          projectId={projectId}
          rangeItems={rangeItems}
        />
      ) : null}
      <div className="border-t pt-6">
        <DeleteTimelineItemDialog
          childEventCount={events.length}
          closeOverlayAfterDelete={closeOverlayAfterDelete}
          redirectAfterDelete
          itemId={item.id}
          projectId={projectId}
          title={item.title}
        />
      </div>
    </div>
  );
}
