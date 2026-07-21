"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";

import { listProjects, projectKeys } from "@/features/projects/api";
import type { ProjectSummary } from "@/features/projects/types";

export function ProjectNavigation({
  initialProjects,
  onNavigate,
}: {
  initialProjects: ProjectSummary[];
  onNavigate?: () => void;
}) {
  const { data: projects = initialProjects } = useQuery({
    queryKey: projectKeys.all,
    queryFn: listProjects,
    initialData: initialProjects,
  });

  return (
    <nav aria-label="メインナビゲーション" className="space-y-1">
      <Link
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
        href="/projects"
        onClick={onNavigate}
      >
        <FolderKanban aria-hidden="true" className="size-4" />
        すべてのプロジェクト
      </Link>
      <Link
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        href="/projects/new"
        onClick={onNavigate}
      >
        <Plus aria-hidden="true" className="size-4" />
        新規プロジェクト
      </Link>
      {projects.length > 0 ? (
        <div className="pt-3">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
            最近のプロジェクト
          </p>
          {projects.slice(0, 8).map((project) => (
            <Link
              key={project.id}
              className="block truncate rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
              href={`/projects/${project.id}/timeline`}
              onClick={onNavigate}
              title={project.name}
            >
              {project.name}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
