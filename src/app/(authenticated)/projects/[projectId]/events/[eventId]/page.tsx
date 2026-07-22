import { notFound } from "next/navigation";

import { TimelineEventDetail } from "@/features/timeline-events/timeline-event-detail";
import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";
import { safeSearchReturnPath } from "@/lib/navigation";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { projectId, eventId } = await params;
  const rawSearch = await searchParams;
  const returnTo = safeSearchReturnPath(
    typeof rawSearch.returnTo === "string" ? rawSearch.returnTo : null,
  );
  let event;
  let project;
  try {
    ({ event, project } = await new TimelineEventService(
      await createClient(),
    ).get(projectId, eventId));
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <DetailPageShell
      breadcrumbParent={{
        href: `/projects/${projectId}/items/${event.parent.id}`,
        label: event.parent.title,
      }}
      projectId={projectId}
      projectName={project.name}
      returnTo={returnTo}
      title={event.title}
    >
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <TimelineEventDetail event={event} projectId={projectId} />
      </div>
    </DetailPageShell>
  );
}
