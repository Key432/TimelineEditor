import { Settings, Tags } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimelineWorkspace } from "@/features/timeline-items/timeline-workspace";
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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {result.project.name}
            </h1>
            <Badge variant="outline">非公開</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            期間型・時点型の項目を登録し、同じ時間軸で比較します。
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${projectId}/item-types`}>
              <Tags aria-hidden="true" className="size-4" />
              対象種別
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${projectId}/settings`}>
              <Settings aria-hidden="true" className="size-4" />
              設定
            </Link>
          </Button>
        </div>
      </header>
      <TimelineWorkspace
        currentYear={new Date().getUTCFullYear()}
        initialItems={result.items}
        itemTypes={result.itemTypes}
        project={result.project}
      />
    </div>
  );
}
