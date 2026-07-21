import { notFound } from "next/navigation";

import { TimelineEventOverlay } from "@/features/timeline-events/timeline-event-overlay";
import { TimelineItemDetail } from "@/features/timeline-items/timeline-item-detail";
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
  let eventCount = 0;
  try {
    const [detail, events] = await Promise.all([
      new TimelineItemService(client).get(projectId, itemId),
      new TimelineEventService(client).list(projectId),
    ]);
    item = detail.item;
    eventCount = events.filter(
      (event) => event.timelineItemId === itemId,
    ).length;
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <TimelineEventOverlay title={item.title}>
      <TimelineItemDetail
        eventCount={eventCount}
        item={item}
        projectId={projectId}
      />
    </TimelineEventOverlay>
  );
}
