import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { TimelineEventSection } from "@/features/timeline-events/timeline-event-section";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemForm } from "@/features/timeline-items/timeline-item-form";
import { ServiceError } from "@/lib/services/errors";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelineItemEditPage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;
  const service = new TimelineItemService(await createClient());
  let detail;
  let listing;
  let events;

  try {
    [detail, listing, events] = await Promise.all([
      service.get(projectId, itemId),
      service.list(projectId),
      new TimelineEventService(await createClient()).list(projectId),
    ]);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  const today = new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/projects/${projectId}/timeline`}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          タイムラインへ戻る
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>タイムラインアイテムの詳細編集</CardTitle>
          <CardDescription>
            本文、出典、外部URLを含むすべての情報を編集します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimelineItemForm
            item={detail.item}
            itemTypes={listing.itemTypes}
            projectId={projectId}
          />
          {detail.item.temporalType === "range" ? (
            <div className="mt-6">
              <TimelineEventSection
                currentDate={{
                  year: today.getUTCFullYear(),
                  month: today.getUTCMonth() + 1,
                  day: today.getUTCDate(),
                }}
                parentId={detail.item.id}
                projectId={projectId}
                rangeItems={listing.items.filter(
                  (item) => item.temporalType === "range",
                )}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">危険な操作</CardTitle>
          <CardDescription>
            この項目を完全に削除します。この操作は取り消せません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteTimelineItemDialog
            childEventCount={
              events.filter((event) => event.timelineItemId === itemId).length
            }
            redirectAfterDelete
            itemId={itemId}
            projectId={projectId}
            title={detail.item.title}
          />
        </CardContent>
      </Card>
    </div>
  );
}
