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
import { ItemTypeManager } from "@/features/item-types/item-type-manager";
import { ServiceError } from "@/lib/services/errors";
import { ItemTypeService } from "@/lib/services/item-type-service";
import { createClient } from "@/lib/supabase/server";

export default async function ItemTypesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let result;

  try {
    result = await new ItemTypeService(await createClient()).list(projectId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/projects/${projectId}/settings`}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            プロジェクト設定へ
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">{result.project.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>タイムライン種別</CardTitle>
          <CardDescription>
            タイムラインアイテムの分類、既定色、表示順を管理します。非表示にしても登録済みデータは削除されません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ItemTypeManager
            initialItemTypes={result.itemTypes}
            projectId={projectId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
