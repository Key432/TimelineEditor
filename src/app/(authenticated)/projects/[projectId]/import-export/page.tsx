import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ImportExportManager } from "@/features/import-export/import-export-manager";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";

export default async function ImportExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  try {
    await new ProjectService(await createClient()).get(projectId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/projects/${projectId}/settings`}>
          <ArrowLeft aria-hidden="true" />
          設定へ戻る
        </Link>
      </Button>
      <ImportExportManager projectId={projectId} />
    </div>
  );
}
