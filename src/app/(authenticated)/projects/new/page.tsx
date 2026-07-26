import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectForm } from "@/features/projects/project-form";
import { NewProjectImport } from "@/features/import-export/new-project-import";

export default function NewProjectPage() {
  const currentYear = new Date().getUTCFullYear();

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
          <CardTitle>新規プロジェクト</CardTitle>
          <CardDescription>
            プロジェクト名は必須です。詳細設定は後から変更できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm currentYear={currentYear} mode="create" />
        </CardContent>
      </Card>
      <NewProjectImport />
    </div>
  );
}
