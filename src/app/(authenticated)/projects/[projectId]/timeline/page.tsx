import { notFound } from "next/navigation";

import { TimelinePageClient } from "@/features/timeline-items/timeline-page-client";
import { ServiceError } from "@/lib/services/errors";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let result;

  try {
    result = await new TimelineItemService(await createClient()).list(
      projectId,
    );
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const today = new Date();

  return (
    <TimelinePageClient
      currentDate={{
        year: today.getUTCFullYear(),
        month: today.getUTCMonth() + 1,
        day: today.getUTCDate(),
      }}
      initialItems={result.items}
      itemTypes={result.itemTypes}
      project={result.project}
    />
  );
}
