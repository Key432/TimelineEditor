import { notFound } from "next/navigation";

import { TimelinePageClient } from "@/features/timeline-items/timeline-page-client";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";
import { BackgroundLayerService } from "@/lib/services/background-layer-service";
import { RelationshipService } from "@/lib/services/relationship-service";

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
    const [listing, events, backgroundLayers, relationships] =
      await Promise.all([
        new TimelineItemService(client).list(projectId),
        new TimelineEventService(client).list(projectId),
        new BackgroundLayerService(client).list(projectId),
        new RelationshipService(client).list(projectId),
      ]);
    result = { ...listing, events, backgroundLayers, relationships };
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
      initialBackgroundLayers={result.backgroundLayers}
      initialRelationships={result.relationships}
      itemTypes={result.itemTypes}
      layoutMode={
        layout === "compact" ? "compact" : layout === "table" ? "table" : "row"
      }
      project={result.project}
    />
  );
}
