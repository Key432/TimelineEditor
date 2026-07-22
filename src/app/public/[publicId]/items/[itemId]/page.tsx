import { notFound } from "next/navigation";

import { TimelineItemDetail } from "@/features/timeline-items/timeline-item-detail";
import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

async function loadPublicItem(publicId: string, itemId: string) {
  const client = await createClient();
  const publicProject = await new ProjectService(client).getPublic(publicId);
  const [detail, events] = await Promise.all([
    new TimelineItemService(client).get(publicProject.id, itemId),
    new TimelineEventService(client).list(publicProject.id),
  ]);
  return { publicProject, detail, events };
}

export default async function PublicTimelineItemPage({
  params,
}: {
  params: Promise<{ publicId: string; itemId: string }>;
}) {
  const { publicId, itemId } = await params;
  let result;
  try {
    result = await loadPublicItem(publicId, itemId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <DetailPageShell
      projectId={result.publicProject.id}
      projectName={result.publicProject.name}
      returnTo={null}
      timelineHref={`/public/${publicId}`}
      title={result.detail.item.title}
    >
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <TimelineItemDetail
          eventBasePath={`/public/${publicId}`}
          events={result.events.filter(
            (event) => event.timelineItemId === itemId,
          )}
          item={result.detail.item}
          projectId={result.publicProject.id}
          readOnly
        />
      </div>
    </DetailPageShell>
  );
}
