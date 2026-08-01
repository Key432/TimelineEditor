import { notFound } from "next/navigation";

import { PublicTimelinePageClient } from "@/features/public-view/public-timeline-page-client";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createPublicClient } from "@/lib/supabase/public";
import { BackgroundLayerService } from "@/lib/services/background-layer-service";

async function loadPublicTimeline(publicId: string) {
  const client = createPublicClient();
  const project = await new ProjectService(client).getPublic(publicId);
  const [listing, events, backgroundLayers] = await Promise.all([
    new TimelineItemService(client).list(project.id),
    new TimelineEventService(client).list(project.id),
    new BackgroundLayerService(client).list(project.id),
  ]);
  return { project, listing, events, backgroundLayers };
}

export default async function PublicTimelinePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
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
      initialBackgroundLayers={result.backgroundLayers}
      initialItems={result.listing.items}
      itemTypes={result.listing.itemTypes}
      project={result.project}
      publicId={publicId}
    />
  );
}
