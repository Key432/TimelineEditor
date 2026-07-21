import { notFound } from "next/navigation";

import { TimelineEventDetail } from "@/features/timeline-events/timeline-event-detail";
import { TimelineEventOverlay } from "@/features/timeline-events/timeline-event-overlay";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineEventModalPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  let event;
  try {
    ({ event } = await new TimelineEventService(await createClient()).get(
      projectId,
      eventId,
    ));
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <TimelineEventOverlay title={event.title}>
      <TimelineEventDetail event={event} projectId={projectId} />
    </TimelineEventOverlay>
  );
}
