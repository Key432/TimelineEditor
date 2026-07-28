import { notFound } from "next/navigation";

import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import { TimelineItemDetailEditor } from "@/features/timeline-items/timeline-item-detail-editor";
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
  let listing;
  let relatedEvents = [];
  try {
    const [detail, itemListing, events] = await Promise.all([
      new TimelineItemService(client).get(projectId, itemId),
      new TimelineItemService(client).list(projectId),
      new TimelineEventService(client).list(projectId),
    ]);
    item = detail.item;
    project = detail.project;
    listing = itemListing;
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
      <DetailEditShell
        placement="page"
        preferenceKey={`/projects/${projectId}/items/${itemId}`}
        editor={
          <TimelineItemDetailEditor
            currentYear={new Date().getUTCFullYear()}
            item={item}
            itemTypes={listing.itemTypes}
            projectId={projectId}
            rangeItems={listing.items.filter(
              (candidate) => candidate.temporalType === "range",
            )}
          />
        }
      >
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <TimelineItemDetail
            events={relatedEvents}
            hardEventNavigation
            item={item}
            projectId={projectId}
          />
        </div>
      </DetailEditShell>
    </DetailPageShell>
  );
}
