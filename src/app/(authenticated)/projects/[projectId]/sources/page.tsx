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
import { SourceManager } from "@/features/sources/source-manager";
import { ServiceError } from "@/lib/services/errors";
import { SourceService } from "@/lib/services/source-service";
import { createClient } from "@/lib/supabase/server";

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let result;
  try {
    result = await new SourceService(await createClient()).list(projectId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/projects/${projectId}/settings`}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          プロジェクト設定へ
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>出典・参考文献</CardTitle>
          <CardDescription>
            書誌情報を一度だけ登録し、複数のタイムラインアイテムやイベントから再利用します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SourceManager
            projectId={projectId}
            initialSources={result.sources}
            initialMissingEntities={result.missingEntities}
          />
        </CardContent>
      </Card>
    </div>
  );
}
