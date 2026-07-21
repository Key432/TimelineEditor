import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TimelineItemDetail } from "@/features/timeline-items/timeline-item-detail";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineItemPage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;
  const client = await createClient();
  let item;
  let eventCount = 0;
  try {
    const [detail, events] = await Promise.all([
      new TimelineItemService(client).get(projectId, itemId),
      new TimelineEventService(client).list(projectId),
    ]);
    item = detail.item;
    eventCount = events.filter(
      (event) => event.timelineItemId === itemId,
    ).length;
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/projects/${projectId}/timeline`}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          タイムラインへ戻る
        </Link>
      </Button>
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <TimelineItemDetail
          eventCount={eventCount}
          item={item}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
