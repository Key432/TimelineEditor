import { notFound } from "next/navigation";

import { TimelineEventDetail } from "@/features/timeline-events/timeline-event-detail";
import { TimelineEventDetailEditor } from "@/features/timeline-events/timeline-event-detail-editor";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";
import { safeSearchReturnPath } from "@/lib/navigation";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
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
  let rangeItems;
  try {
    const client = await createClient();
    const [detail, listing] = await Promise.all([
      new TimelineEventService(client).get(projectId, eventId),
      new TimelineItemService(client).list(projectId),
    ]);
    ({ event, project } = detail);
    rangeItems = listing.items.filter((item) => item.temporalType === "range");
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <DetailPageShell
      breadcrumbParents={event.parents.map((parent) => ({
        href: `/projects/${projectId}/items/${parent.id}`,
        label: parent.title,
        hardNavigation: true,
      }))}
      projectId={projectId}
      projectName={project.name}
      returnTo={returnTo}
      title={event.title}
    >
      <DetailEditShell
        placement="page"
        preferenceKey={`/projects/${projectId}/events/${eventId}`}
        editor={
          <TimelineEventDetailEditor
            currentYear={new Date().getUTCFullYear()}
            event={event}
            projectId={projectId}
            rangeItems={rangeItems}
          />
        }
      >
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <TimelineEventDetail event={event} projectId={projectId} />
        </div>
      </DetailEditShell>
    </DetailPageShell>
  );
}
