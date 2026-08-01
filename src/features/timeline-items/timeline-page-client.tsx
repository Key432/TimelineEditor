"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileArchive, Settings, Shapes } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { itemTypeKeys } from "@/features/item-types/api";
import { ImportExportManager } from "@/features/import-export/import-export-manager";
import type { TimelineItemType } from "@/features/item-types/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { timelineEventKeys } from "@/features/timeline-events/api";
import { DeleteProjectDialog } from "@/features/projects/delete-project-dialog";
import { ProjectForm } from "@/features/projects/project-form";
import { ProjectSharing } from "@/features/projects/project-sharing";
import { CollapsibleProjectDescription } from "@/features/projects/collapsible-project-description";
import type { Project } from "@/features/projects/types";
import type {
  HistoricalDate,
  TimelineLayoutMode,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import {
  parseTimelineFilters,
  writeTimelineFilters,
} from "@/features/timeline-items/timeline-filters";
import { TimelineWorkspace } from "@/features/timeline-items/timeline-workspace";
import { timelineItemKeys } from "@/features/timeline-items/api";
import { cn } from "@/lib/utils";
import { TrashManager } from "@/features/history/trash-manager";
import { ClassificationManager } from "@/features/classification/classification-manager";
import { invalidateEventTypeDependents } from "@/features/classification/cache";
import { invalidateItemTypeDependents } from "@/features/item-types/cache";
import { SourceManager } from "@/features/sources/source-manager";

type Panel = "settings" | "classification" | "sources" | "import-export" | null;

export function TimelinePageClient({
  project,
  initialItems,
  initialEvents = [],
  itemTypes,
  currentDate,
  layoutMode,
}: {
  project: Project;
  initialItems: TimelineItemSummary[];
  initialEvents?: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  layoutMode: TimelineLayoutMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [activeProject, setActiveProject] = useState(project);
  const [panel, setPanel] = useState<Panel>(null);
  const filters = useMemo(
    () => parseTimelineFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  function handlePanelChange(open: boolean) {
    if (open) return;
    if (panel === "classification") {
      void Promise.all([
        invalidateItemTypeDependents(queryClient, project.id),
        invalidateEventTypeDependents(queryClient, project.id),
      ]);
    }
    setPanel(null);
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {activeProject.name}
            </h1>
            <Badge variant="outline">
              {activeProject.visibility === "public" ? "公開中" : "非公開"}
            </Badge>
          </div>
          {activeProject.description ? (
            <CollapsibleProjectDescription
              description={activeProject.description}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPanel("classification")}
          >
            <Shapes aria-hidden="true" className="size-4" />
            種別・タグ・カスタムフィールド
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPanel("sources")}
          >
            <BookOpen aria-hidden="true" className="size-4" />
            出典・参考文献
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPanel("settings")}
          >
            <Settings aria-hidden="true" className="size-4" />
            設定
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPanel("import-export")}
          >
            <FileArchive aria-hidden="true" className="size-4" />
            インポート／エクスポート
          </Button>
        </div>
      </header>

      <TimelineWorkspace
        key={activeProject.updatedAt}
        currentDate={currentDate}
        initialItems={initialItems}
        initialEvents={initialEvents}
        itemTypes={itemTypes}
        layoutMode={layoutMode}
        filters={filters}
        project={activeProject}
        onFiltersChange={(nextFilters) => {
          const next = writeTimelineFilters(
            new URLSearchParams(searchParams.toString()),
            nextFilters,
          );
          window.history.replaceState(null, "", `${pathname}?${next}`);
        }}
        onLayoutModeChange={(nextLayout) => {
          const nextSearchParams = new URLSearchParams(searchParams.toString());
          nextSearchParams.set("layout", nextLayout);
          router.replace(`${pathname}?${nextSearchParams.toString()}`, {
            scroll: false,
          });
        }}
        onOpenEvent={(eventId, editing) =>
          router.push(
            `/projects/${project.id}/events/${eventId}${editing ? "/edit" : ""}`,
          )
        }
        onOpenItem={(itemId) =>
          router.push(`/projects/${project.id}/items/${itemId}`)
        }
        onEditItemTypes={() => setPanel("classification")}
      />

      <Sheet open={panel !== null} onOpenChange={handlePanelChange}>
        <SheetContent
          onOpenAutoFocus={(event) => {
            if (panel !== "classification") return;
            event.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur();
          }}
          className={cn(
            "w-full overflow-y-auto",
            panel === "classification" || panel === "sources"
              ? "sm:!w-[calc(100vw-4rem)] sm:!max-w-5xl"
              : "sm:max-w-3xl",
          )}
        >
          <SheetHeader>
            <SheetTitle>
              {panel === "settings"
                ? "プロジェクト設定"
                : panel === "classification"
                  ? "種別・タグ・カスタムフィールド"
                  : panel === "sources"
                    ? "出典・参考文献"
                    : "インポート／エクスポート"}
            </SheetTitle>
            <SheetDescription>
              {panel === "settings"
                ? "名前、説明、タイムラインの初期表示を変更します。"
                : panel === "classification"
                  ? "タイムライン種別、イベント種別、タグ、用途固有の型付きフィールドを管理します。"
                  : panel === "sources"
                    ? "資料の追加・編集・一覧確認と、出典未設定項目の確認を行います。"
                    : "プロジェクトデータを保存または取り込みます。"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-8 px-4 pb-6">
            {panel === "settings" ? (
              <>
                <ProjectForm
                  currentYear={currentDate.year}
                  mode="edit"
                  navigateAfterSave={false}
                  project={activeProject}
                  onSaved={(savedProject) => {
                    setActiveProject(savedProject);
                    setPanel(null);
                  }}
                />
                <div className="space-y-3 border-t pt-6">
                  <h2 className="font-medium">公開・共有</h2>
                  <ProjectSharing
                    project={activeProject}
                    onChanged={setActiveProject}
                  />
                </div>
                <TrashManager projectId={project.id} />
                <div className="space-y-3 border-t border-destructive/30 pt-6">
                  <h2 className="font-medium text-destructive">危険な操作</h2>
                  <p className="text-sm text-muted-foreground">
                    プロジェクトと配下データを完全に削除します。この操作は取り消せません。
                  </p>
                  <DeleteProjectDialog
                    projectId={activeProject.id}
                    projectName={activeProject.name}
                  />
                </div>
              </>
            ) : panel === "classification" ? (
              <ClassificationManager
                projectId={project.id}
                itemTypes={itemTypes}
              />
            ) : panel === "sources" ? (
              <SourceManager projectId={project.id} />
            ) : panel === "import-export" ? (
              <ImportExportManager
                itemTypes={itemTypes}
                projectId={project.id}
                onImported={() => {
                  void Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: itemTypeKeys.list(project.id),
                    }),
                    queryClient.invalidateQueries({
                      queryKey: timelineItemKeys.list(project.id),
                    }),
                    queryClient.invalidateQueries({
                      queryKey: timelineEventKeys.list(project.id),
                    }),
                  ]);
                  setPanel(null);
                  router.refresh();
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
