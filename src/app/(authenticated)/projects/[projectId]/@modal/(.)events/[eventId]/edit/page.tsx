import { notFound } from "next/navigation";

import { TimelineEventForm } from "@/features/timeline-events/timeline-event-form";
import { TimelineEventOverlay } from "@/features/timeline-events/timeline-event-overlay";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineEventEditModalPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  const client = await createClient();
  let event;
  let items;
  try {
    const [detail, listing] = await Promise.all([
      new TimelineEventService(client).get(projectId, eventId),
      new TimelineItemService(client).list(projectId),
    ]);
    event = detail.event;
    items = listing.items.filter((item) => item.temporalType === "range");
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  const today = new Date();
  return (
    <TimelineEventOverlay showTitle title="イベントアイテムを編集">
      <div className="px-6 pb-8 sm:px-10 sm:pb-10">
        <TimelineEventForm
          currentDate={{
            year: today.getUTCFullYear(),
            month: today.getUTCMonth() + 1,
            day: today.getUTCDate(),
          }}
          event={event}
          projectId={projectId}
          rangeItems={items}
        />
      </div>
    </TimelineEventOverlay>
  );
}
