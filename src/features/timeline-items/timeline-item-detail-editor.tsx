"use client";

import { useQuery } from "@tanstack/react-query";

import { TimelineEventSection } from "@/features/timeline-events/timeline-event-section";
import {
  getTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";
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
  currentYear,
  closeOverlayAfterDelete = false,
}: {
  projectId: string;
  item: TimelineItem;
  itemTypes: TimelineItemType[];
  rangeItems: TimelineItemSummary[];
  currentYear: number;
  closeOverlayAfterDelete?: boolean;
}) {
  const { onDirtyChange, onSaved } = useDetailEditorActions();
  const { data: currentItem } = useQuery({
    queryKey: timelineItemKeys.detail(projectId, item.id),
    queryFn: () => getTimelineItem(projectId, item.id),
    initialData: item,
  });
  return (
    <div className="space-y-6">
      <TimelineItemForm
        item={currentItem}
        itemTypes={itemTypes}
        projectId={projectId}
        onDirtyChange={onDirtyChange}
        onSaved={onSaved}
      />
      {currentItem.temporalType === "range" ? (
        <TimelineEventSection
          currentDate={{ year: currentYear, month: 1, day: 1 }}
          parentId={currentItem.id}
          projectId={projectId}
          rangeItems={rangeItems}
        />
      ) : null}
      <div className="border-t pt-6">
        <DeleteTimelineItemDialog
          closeOverlayAfterDelete={closeOverlayAfterDelete}
          redirectAfterDelete
          itemId={currentItem.id}
          projectId={projectId}
          title={currentItem.title}
        />
      </div>
    </div>
  );
}
