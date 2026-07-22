import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
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
      projectId={projectId}
      projectName={project.name}
      returnTo={returnTo}
      title={event.title}
    >
      <Card>
        <CardContent className="pt-6">
          <TimelineEventDetail event={event} projectId={projectId} />
        </CardContent>
      </Card>
    </DetailPageShell>
  );
}
