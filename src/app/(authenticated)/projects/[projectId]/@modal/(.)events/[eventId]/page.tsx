import { notFound } from "next/navigation";

import { TimelineEventDetail } from "@/features/timeline-events/timeline-event-detail";
import { TimelineEventDetailEditor } from "@/features/timeline-events/timeline-event-detail-editor";
import { TimelineEventOverlay } from "@/features/timeline-events/timeline-event-overlay";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineEventModalPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  let event;
  let rangeItems;
  try {
    const client = await createClient();
    const [detail, listing] = await Promise.all([
      new TimelineEventService(client).get(projectId, eventId),
      new TimelineItemService(client).list(projectId),
    ]);
    ({ event } = detail);
    rangeItems = listing.items.filter((item) => item.temporalType === "range");
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <TimelineEventOverlay title={event.title}>
      <DetailEditShell
        placement="overlay"
        preferenceKey={`/projects/${projectId}/events/${eventId}`}
        editor={
          <TimelineEventDetailEditor
            currentYear={new Date().getUTCFullYear()}
            event={event}
            projectId={projectId}
            rangeItems={rangeItems}
          />
        }
      >
        <TimelineEventDetail
          closeOverlayAfterDelete
          event={event}
          projectId={projectId}
        />
      </DetailEditShell>
    </TimelineEventOverlay>
  );
}
