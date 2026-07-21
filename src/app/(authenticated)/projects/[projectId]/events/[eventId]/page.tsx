import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TimelineEventDetail } from "@/features/timeline-events/timeline-event-detail";
import { ServiceError } from "@/lib/services/errors";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineEventPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  let event;
  try {
    ({ event } = await new TimelineEventService(await createClient()).get(
      projectId,
      eventId,
    ));
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/projects/${projectId}/timeline`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          タイムラインへ戻る
        </Link>
      </Button>
      <Card>
        <CardContent className="pt-6">
          <TimelineEventDetail event={event} projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
}
