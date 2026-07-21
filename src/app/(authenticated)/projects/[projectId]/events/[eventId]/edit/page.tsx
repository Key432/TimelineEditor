import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineEventForm } from "@/features/timeline-events/timeline-event-form";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineEventEditPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  const client = await createClient();
  let event;
  let items;
  try {
    const [detail, listing] = await Promise.all([
      new TimelineEventService(client).get(projectId, eventId),
      new TimelineItemService(client).list(projectId),
    ]);
    event = detail.event;
    items = listing.items.filter((item) => item.temporalType === "range");
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  const today = new Date();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/projects/${projectId}/events/${eventId}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          詳細へ戻る
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>子イベントを編集</CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineEventForm
            currentDate={{
              year: today.getUTCFullYear(),
              month: today.getUTCMonth() + 1,
              day: today.getUTCDate(),
            }}
            event={event}
            projectId={projectId}
            rangeItems={items}
          />
        </CardContent>
      </Card>
    </div>
  );
}
