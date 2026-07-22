import { notFound } from "next/navigation";

import { TimelinePageClient } from "@/features/timeline-items/timeline-page-client";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ layout?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { layout } = await searchParams;
  let result;

  try {
    const client = await createClient();
    const [listing, events] = await Promise.all([
      new TimelineItemService(client).list(projectId),
      new TimelineEventService(client).list(projectId),
    ]);
    result = { ...listing, events };
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const today = new Date();

  return (
    <TimelinePageClient
      currentDate={{
        year: today.getUTCFullYear(),
        month: today.getUTCMonth() + 1,
        day: today.getUTCDate(),
      }}
      initialItems={result.items}
      initialEvents={result.events}
      itemTypes={result.itemTypes}
      layoutMode={layout === "compact" ? "compact" : "row"}
      project={result.project}
    />
  );
}
