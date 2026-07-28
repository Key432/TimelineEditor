import { notFound } from "next/navigation";

import { TimelineEventOverlay } from "@/features/timeline-events/timeline-event-overlay";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import { TimelineItemDetail } from "@/features/timeline-items/timeline-item-detail";
import { TimelineItemDetailEditor } from "@/features/timeline-items/timeline-item-detail-editor";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineItemModalPage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;
  const client = await createClient();
  let item;
  let listing;
  let relatedEvents = [];
  try {
    const [detail, itemListing, events] = await Promise.all([
      new TimelineItemService(client).get(projectId, itemId),
      new TimelineItemService(client).list(projectId),
      new TimelineEventService(client).list(projectId),
    ]);
    item = detail.item;
    listing = itemListing;
    relatedEvents = events.filter((event) => event.timelineItemId === itemId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <TimelineEventOverlay title={item.title}>
      <DetailEditShell
        placement="overlay"
        preferenceKey={`/projects/${projectId}/items/${itemId}`}
        editor={
          <TimelineItemDetailEditor
            closeOverlayAfterDelete
            currentYear={new Date().getUTCFullYear()}
            item={item}
            itemTypes={listing.itemTypes}
            projectId={projectId}
            rangeItems={listing.items.filter(
              (candidate) => candidate.temporalType === "range",
            )}
          />
        }
      >
        <TimelineItemDetail
          closeOverlayAfterDelete
          events={relatedEvents}
          item={item}
          projectId={projectId}
        />
      </DetailEditShell>
    </TimelineEventOverlay>
  );
}
