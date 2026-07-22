import { notFound } from "next/navigation";

import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";
import { TimelineItemDetail } from "@/features/timeline-items/timeline-item-detail";
import { safeSearchReturnPath } from "@/lib/navigation";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { projectId, itemId } = await params;
  const rawSearch = await searchParams;
  const returnTo = safeSearchReturnPath(
    typeof rawSearch.returnTo === "string" ? rawSearch.returnTo : null,
  );
  const client = await createClient();
  let item;
  let project;
  let relatedEvents = [];
  try {
    const [detail, events] = await Promise.all([
      new TimelineItemService(client).get(projectId, itemId),
      new TimelineEventService(client).list(projectId),
    ]);
    item = detail.item;
    project = detail.project;
    relatedEvents = events.filter((event) => event.timelineItemId === itemId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <DetailPageShell
      projectId={projectId}
      projectName={project.name}
      returnTo={returnTo}
      title={item.title}
    >
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <TimelineItemDetail
          events={relatedEvents}
          item={item}
          projectId={projectId}
        />
      </div>
    </DetailPageShell>
  );
}
