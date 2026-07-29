import { notFound } from "next/navigation";

import { TimelineEventDetail } from "@/features/timeline-events/timeline-event-detail";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { createPublicClient } from "@/lib/supabase/public";

async function loadPublicEvent(publicId: string, eventId: string) {
  const client = createPublicClient();
  const project = await new ProjectService(client).getPublic(publicId);
  const { event } = await new TimelineEventService(client).get(
    project.id,
    eventId,
  );
  return { project, event };
}

export default async function PublicTimelineEventPage({
  params,
}: {
  params: Promise<{ publicId: string; eventId: string }>;
}) {
  const { publicId, eventId } = await params;
  let result;
  try {
    result = await loadPublicEvent(publicId, eventId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <DetailPageShell
      breadcrumbParents={result.event.parents.map((parent) => ({
        href: `/public/${publicId}/items/${parent.id}`,
        label: parent.title,
      }))}
      projectId={result.project.id}
      projectName={result.project.name}
      returnTo={null}
      timelineHref={`/public/${publicId}`}
      title={result.event.title}
    >
      <DetailEditShell
        placement="page"
        preferenceKey={`/public/${publicId}/events/${eventId}`}
        readOnly
      >
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <TimelineEventDetail
            event={result.event}
            internalLinkBasePath={`/public/${publicId}`}
            projectId={result.project.id}
            readOnly
          />
        </div>
      </DetailEditShell>
    </DetailPageShell>
  );
}
