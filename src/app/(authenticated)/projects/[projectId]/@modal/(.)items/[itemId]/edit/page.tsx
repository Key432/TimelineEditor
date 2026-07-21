import { notFound } from "next/navigation";

import { TimelineEventOverlay } from "@/features/timeline-events/timeline-event-overlay";
import { TimelineEventSection } from "@/features/timeline-events/timeline-event-section";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { TimelineItemForm } from "@/features/timeline-items/timeline-item-form";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineItemEditModalPage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;
  const client = await createClient();
  const itemService = new TimelineItemService(client);
  let detail;
  let listing;
  let events;

  try {
    [detail, listing, events] = await Promise.all([
      itemService.get(projectId, itemId),
      itemService.list(projectId),
      new TimelineEventService(client).list(projectId),
    ]);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const today = new Date();
  return (
    <TimelineEventOverlay showTitle title="タイムラインアイテムを編集">
      <div className="space-y-6 px-6 pb-8 sm:px-10 sm:pb-10">
        <TimelineItemForm
          item={detail.item}
          itemTypes={listing.itemTypes}
          projectId={projectId}
        />
        {detail.item.temporalType === "range" ? (
          <TimelineEventSection
            currentDate={{
              year: today.getUTCFullYear(),
              month: today.getUTCMonth() + 1,
              day: today.getUTCDate(),
            }}
            parentId={detail.item.id}
            projectId={projectId}
            rangeItems={listing.items.filter(
              (item) => item.temporalType === "range",
            )}
          />
        ) : null}
        <div className="border-t pt-6">
          <DeleteTimelineItemDialog
            childEventCount={
              events.filter((event) => event.timelineItemId === itemId).length
            }
            redirectAfterDelete
            itemId={itemId}
            projectId={projectId}
            title={detail.item.title}
          />
        </div>
      </div>
    </TimelineEventOverlay>
  );
}
