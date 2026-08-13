"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Ellipsis,
  FileArchive,
  Layers3,
  Settings,
  Shapes,
  ShieldCheck,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { itemTypeKeys } from "@/features/item-types/api";
import type { TimelineItemType } from "@/features/item-types/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { timelineEventKeys } from "@/features/timeline-events/api";
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
import { invalidateEventTypeDependents } from "@/features/classification/cache";
import { invalidateItemTypeDependents } from "@/features/item-types/cache";
import type { TimelineBackgroundLayer } from "@/features/background-layers/types";
import type { RelationshipDataset } from "@/features/relationships/types";
import { TimelinePanelSkeleton } from "@/features/timeline-items/timeline-loading-skeleton";

const panelLoading = () => <TimelinePanelSkeleton />;

const ImportExportManager = dynamic(
  () =>
    import("@/features/import-export/import-export-manager").then(
      (module) => module.ImportExportManager,
    ),
  { loading: panelLoading },
);
const DeleteProjectDialog = dynamic(
  () =>
    import("@/features/projects/delete-project-dialog").then(
      (module) => module.DeleteProjectDialog,
    ),
  { loading: panelLoading },
);
const ProjectForm = dynamic(
  () =>
    import("@/features/projects/project-form").then(
      (module) => module.ProjectForm,
    ),
  { loading: panelLoading },
);
const ProjectSharing = dynamic(
  () =>
    import("@/features/projects/project-sharing").then(
      (module) => module.ProjectSharing,
    ),
  { loading: panelLoading },
);
const TrashManager = dynamic(
  () =>
    import("@/features/history/trash-manager").then(
      (module) => module.TrashManager,
    ),
  { loading: panelLoading },
);
const ClassificationManager = dynamic(
  () =>
    import("@/features/classification/classification-manager").then(
      (module) => module.ClassificationManager,
    ),
  { loading: panelLoading },
);
const SourceManager = dynamic(
  () =>
    import("@/features/sources/source-manager").then(
      (module) => module.SourceManager,
    ),
  { loading: panelLoading },
);
const BackgroundLayerManager = dynamic(
  () =>
    import("@/features/background-layers/background-layer-manager").then(
      (module) => module.BackgroundLayerManager,
    ),
  { loading: panelLoading },
);

const ProjectAnalysisManager = dynamic(
  () =>
    import("@/features/project-analysis/project-analysis-manager").then(
      (module) => module.ProjectAnalysisManager,
    ),
  {
    loading: () => (
      <p className="text-sm text-muted-foreground">
        データ品質を準備しています…
      </p>
    ),
  },
);

type Panel =
  | "settings"
  | "classification"
  | "backgrounds"
  | "sources"
  | "analysis"
  | "import-export"
  | null;

export function TimelinePageClient({
  project,
  initialItems,
  initialEvents,
  itemTypes,
  currentDate,
  layoutMode,
  initialBackgroundLayers,
  initialRelationships,
}: {
  project: Project;
  initialItems: TimelineItemSummary[];
  initialEvents?: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  layoutMode: TimelineLayoutMode;
  initialBackgroundLayers?: TimelineBackgroundLayer[];
  initialRelationships?: RelationshipDataset;
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Ellipsis aria-hidden="true" className="size-4" />
              管理メニュー
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>データを整える</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => setPanel("analysis")}>
                <ShieldCheck aria-hidden="true" />
                データ品質・重複統合
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPanel("classification")}>
                <Shapes aria-hidden="true" />
                分類・関係
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPanel("sources")}>
                <BookOpen aria-hidden="true" />
                出典・参考文献
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>表示とプロジェクト</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => setPanel("backgrounds")}>
                <Layers3 aria-hidden="true" />
                年代背景
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPanel("settings")}>
                <Settings aria-hidden="true" />
                プロジェクト設定・共有
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPanel("import-export")}>
                <FileArchive aria-hidden="true" />
                インポート／エクスポート
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <TimelineWorkspace
        key={activeProject.updatedAt}
        currentDate={currentDate}
        initialItems={initialItems}
        initialEvents={initialEvents}
        initialBackgroundLayers={initialBackgroundLayers}
        initialRelationships={initialRelationships}
        itemTypes={itemTypes}
        layoutMode={layoutMode}
        filters={filters}
        project={activeProject}
        lazyLoadSupplementalData
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
            panel === "classification" ||
              panel === "backgrounds" ||
              panel === "sources" ||
              panel === "analysis"
              ? "sm:!w-[calc(100vw-4rem)] sm:!max-w-5xl"
              : "sm:max-w-3xl",
          )}
        >
          <SheetHeader>
            <SheetTitle>
              {panel === "settings"
                ? "プロジェクト設定"
                : panel === "classification"
                  ? "分類・関係"
                  : panel === "backgrounds"
                    ? "年代背景レイヤー"
                    : panel === "sources"
                      ? "出典・参考文献"
                      : panel === "analysis"
                        ? "データ品質・重複統合"
                        : "インポート／エクスポート"}
            </SheetTitle>
            <SheetDescription>
              {panel === "settings"
                ? "名前、説明、タイムラインの初期表示を変更します。"
                : panel === "classification"
                  ? "タイムライン種別、イベント種別、タグ、カスタムフィールド、意味的関係を管理します。"
                  : panel === "backgrounds"
                    ? "時代区分、王朝、政権、文化潮流などを複数の背景として管理します。"
                    : panel === "sources"
                      ? "資料の追加・編集・一覧確認と、出典未設定項目の確認を行います。"
                      : panel === "analysis"
                        ? "不整合を修正し、重複データを参照関係ごと安全に統合します。"
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
            ) : panel === "backgrounds" ? (
              <BackgroundLayerManager
                initialLayers={initialBackgroundLayers ?? []}
                projectId={project.id}
              />
            ) : panel === "sources" ? (
              <SourceManager projectId={project.id} />
            ) : panel === "analysis" ? (
              <ProjectAnalysisManager
                projectId={project.id}
                onOpenClassification={() => setPanel("classification")}
              />
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
