import { FolderPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ProjectList } from "@/features/projects/project-list";
import { LocalProjectCloudImport } from "@/features/local-projects/cloud-import";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const projects = await new ProjectService(await createClient()).list();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            プロジェクト
          </h1>
          <p className="text-sm text-muted-foreground">
            年表プロジェクトを作成し、表示設定を管理します。
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <FolderPlus aria-hidden="true" className="size-4" />
            新規プロジェクト
          </Link>
        </Button>
      </div>
      <ProjectList initialProjects={projects} />
      <LocalProjectCloudImport />
    </div>
  );
}
