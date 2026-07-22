import { notFound } from "next/navigation";

import { PublicTimelinePageClient } from "@/features/public-view/public-timeline-page-client";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

async function loadPublicTimeline(publicId: string) {
  const client = await createClient();
  const project = await new ProjectService(client).getPublic(publicId);
  const [listing, events] = await Promise.all([
    new TimelineItemService(client).list(project.id),
    new TimelineEventService(client).list(project.id),
  ]);
  return { project, listing, events };
}

export default async function PublicTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ layout?: string | string[] }>;
}) {
  const { publicId } = await params;
  const { layout } = await searchParams;
  let result;
  try {
    result = await loadPublicTimeline(publicId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  const today = new Date();
  return (
    <PublicTimelinePageClient
      currentDate={{
        year: today.getUTCFullYear(),
        month: today.getUTCMonth() + 1,
        day: today.getUTCDate(),
      }}
      initialEvents={result.events}
      initialItems={result.listing.items}
      itemTypes={result.listing.itemTypes}
      layoutMode={layout === "compact" ? "compact" : "row"}
      project={result.project}
      publicId={publicId}
    />
  );
}
