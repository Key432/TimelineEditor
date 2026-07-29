"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, FolderPlus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listProjects, projectKeys } from "@/features/projects/api";
import type { ProjectSummary } from "@/features/projects/types";

export function ProjectList({
  initialProjects,
}: {
  initialProjects: ProjectSummary[];
}) {
  const { data: projects = initialProjects } = useQuery({
    queryKey: projectKeys.all,
    queryFn: listProjects,
    initialData: initialProjects,
  });

  if (projects.length === 0) {
    return (
      <Card className="max-w-2xl border-dashed shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">最初の年表を作成しましょう</CardTitle>
          <CardDescription>
            プロジェクト名だけで作成し、表示範囲などは後から変更できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/projects/new">
              <FolderPlus aria-hidden="true" className="size-4" />
              新規プロジェクト
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Card
          className="relative transition-colors hover:bg-muted/30"
          key={project.id}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="line-clamp-2 text-lg">
                {project.name}
              </CardTitle>
              <Badge
                variant={
                  project.visibility === "public" ? "secondary" : "outline"
                }
              >
                {project.visibility === "public" ? "公開済" : "非公開"}
              </Badge>
            </div>
            {project.description ? (
              <CardDescription className="line-clamp-3 min-h-10">
                {project.description}
              </CardDescription>
            ) : (
              <div aria-hidden="true" className="min-h-10" />
            )}
            <Link
              aria-label={`${project.name}のタイムラインを開く`}
              className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              href={`/projects/${project.id}/timeline`}
            />
          </CardHeader>
          <CardFooter className="pointer-events-none justify-end gap-2">
            <Button
              asChild
              className="pointer-events-auto relative z-10"
              size="sm"
              variant="outline"
            >
              <Link
                aria-label={`${project.name}の出典・参考文献を開く`}
                href={`/projects/${project.id}/sources`}
              >
                <BookOpen aria-hidden="true" className="size-4" />
                出典・参考文献
              </Link>
            </Button>
            <Button
              asChild
              className="pointer-events-auto relative z-10"
              size="sm"
              variant="outline"
            >
              <Link
                aria-label={`${project.name}の設定を開く`}
                href={`/projects/${project.id}/settings`}
              >
                設定を開く
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
