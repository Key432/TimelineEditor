import { ArrowLeft, FileArchive, Tags } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteProjectDialog } from "@/features/projects/delete-project-dialog";
import { ProjectForm } from "@/features/projects/project-form";
import { ProjectSharing } from "@/features/projects/project-sharing";
import { TrashManager } from "@/features/history/trash-manager";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let project;

  try {
    project = await new ProjectService(await createClient()).get(projectId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild size="sm" variant="ghost">
        <Link href="/projects">
          <ArrowLeft aria-hidden="true" className="size-4" />
          一覧へ戻る
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">入出力</CardTitle>
          <CardDescription>
            JSONバックアップとCSV ZIPの保存・取り込みを行います。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/import-export`}>
              <FileArchive aria-hidden="true" className="size-4" />
              インポート／エクスポート
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>プロジェクト設定</CardTitle>
              <CardDescription>
                名前、説明、タイムラインの初期表示を変更します。
              </CardDescription>
            </div>
            <Badge variant="outline">
              {project.visibility === "public" ? "公開中" : "非公開"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectForm
            currentYear={new Date().getUTCFullYear()}
            mode="edit"
            project={project}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">公開・共有</CardTitle>
          <CardDescription>
            閲覧専用URLの公開状態と共有先を管理します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectSharing project={project} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">タイムライン種別</CardTitle>
          <CardDescription>
            分類名、既定色、表示順、表示状態をプロジェクトごとに管理します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/item-types`}>
              <Tags aria-hidden="true" className="size-4" />
              タイムライン種別を管理
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TrashManager projectId={project.id} separated={false} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">危険な操作</CardTitle>
          <CardDescription>
            プロジェクトと配下データを完全に削除します。この操作は取り消せません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteProjectDialog
            projectId={project.id}
            projectName={project.name}
          />
        </CardContent>
      </Card>
    </div>
  );
}
