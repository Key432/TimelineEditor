"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Columns3, GripVertical, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  comparisonKeys,
  listComparisonProjects,
  loadComparisonProject,
} from "@/features/comparison/api";
import {
  buildComparisonTimelineDomain,
  comparisonPaneHeight,
  moveComparedProject,
} from "@/features/comparison/comparison-layout";
import type { ComparisonProjectOption } from "@/features/comparison/types";
import type { TimelineItemType } from "@/features/item-types/types";
import type { Project } from "@/features/projects/types";
import type { RelationshipDataset } from "@/features/relationships/types";
import type { TimelineBackgroundLayer } from "@/features/background-layers/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type { TimelineFilters } from "@/features/timeline-items/timeline-filters";
import { createTimelineStore } from "@/features/timeline-items/timeline-store";
import { TimelineWorkspace } from "@/features/timeline-items/timeline-workspace";
import type {
  HistoricalDate,
  TimelineItemSummary,
  TimelineLayoutMode,
} from "@/features/timeline-items/types";

const EMPTY_RELATIONSHIPS: RelationshipDataset = {
  relationships: [],
  entities: [],
};

function comparisonProjectIds(
  searchParams: URLSearchParams,
  projectId: string,
) {
  return Array.from(
    new Set(
      searchParams
        .getAll("compare")
        .flatMap((value) => value.split(","))
        .filter(Boolean),
    ),
  ).filter((candidateId) => candidateId !== projectId);
}

function SortableComparisonProject({
  project,
  onRemove,
}: {
  project: ComparisonProjectOption;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: project.id });

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 rounded-md border bg-background p-2"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        {...attributes}
        {...listeners}
        aria-label={`${project.name}を並べ替え`}
        className="cursor-grab touch-none active:cursor-grabbing"
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {project.name}
      </span>
      <Button
        aria-label={`${project.name}を比較から外す`}
        size="icon-sm"
        type="button"
        variant="ghost"
        onClick={onRemove}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

type TimelineComparisonWorkspaceProps = {
  project: Project;
  initialItems: TimelineItemSummary[];
  initialEvents?: TimelineEventSummary[];
  initialBackgroundLayers?: TimelineBackgroundLayer[];
  initialRelationships?: RelationshipDataset;
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  layoutMode: TimelineLayoutMode;
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
  onLayoutModeChange: (layoutMode: TimelineLayoutMode) => void;
  onOpenEvent: (eventId: string, editing: boolean) => void;
  onOpenItem: (itemId: string) => void;
  onEditItemTypes: () => void;
  headerActionsContainer?: HTMLElement | null;
  onHighlightRangeChange?: (
    range: { startOrdinal: number; endOrdinal: number } | null,
  ) => void;
};

export function TimelineComparisonWorkspace(
  props: TimelineComparisonWorkspaceProps,
) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [sharedStore] = useState(() =>
    createTimelineStore(props.project.settings),
  );
  const onHighlightRangeChange = props.onHighlightRangeChange;
  useEffect(
    () =>
      sharedStore.subscribe((state, previous) => {
        if (state.highlightRange !== previous.highlightRange)
          onHighlightRangeChange?.(state.highlightRange);
      }),
    [onHighlightRangeChange, sharedStore],
  );
  const comparisonSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [projectIds, setProjectIds] = useState(() =>
    comparisonProjectIds(searchParams, props.project.id),
  );
  const comparing = projectIds.length > 0;
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: comparisonKeys.projects,
    queryFn: listComparisonProjects,
    enabled: dialogOpen || comparing,
  });
  const projectQueries = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: comparisonKeys.project(projectId),
      queryFn: () => loadComparisonProject(projectId),
    })),
  });
  const datasets = projectQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const projectQueriesById = new Map(
    projectQueries.flatMap((query) =>
      query.data ? ([[query.data.project.id, query]] as const) : [],
    ),
  );
  const domain = buildComparisonTimelineDomain(
    [
      {
        project: props.project,
        items: props.initialItems,
        events: props.initialEvents ?? [],
      },
      ...datasets,
    ],
    props.currentDate,
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("ja");
  const filteredProjects = projects.filter(
    (candidate) =>
      candidate.id !== props.project.id &&
      !draftIds.includes(candidate.id) &&
      (!normalizedSearch ||
        candidate.name.toLocaleLowerCase("ja").includes(normalizedSearch) ||
        candidate.description
          ?.toLocaleLowerCase("ja")
          .includes(normalizedSearch)),
  );
  const projectsById = new Map(
    projects.map((candidate) => [candidate.id, candidate]),
  );
  const selectedProjects = draftIds.flatMap((projectId) => {
    const selectedProject = projectsById.get(projectId);
    return selectedProject ? [selectedProject] : [];
  });

  function writeProjectIds(nextIds: string[]) {
    setProjectIds(nextIds);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("compare");
    if (nextIds.length > 0) next.set("compare", nextIds.join(","));
    const query = next.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  }

  function openDialog() {
    setDraftIds(projectIds);
    setSearch("");
    setDialogOpen(true);
  }

  const paneHeight = comparisonPaneHeight(projectIds.length + 1);

  function handleComparisonDragEnd(event: DragEndEvent) {
    const overProjectId = event.over?.id;
    if (!overProjectId) return;
    // Commit the reordered draft before dnd-kit releases the pointer so an
    // immediate click on the confirm button cannot observe the previous order.
    flushSync(() => {
      setDraftIds((current) => {
        return moveComparedProject(
          current,
          String(event.active.id),
          String(overProjectId),
        );
      });
    });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      {props.headerActionsContainer
        ? createPortal(
            <>
              {comparing ? (
                <Badge variant="secondary">
                  {projectIds.length + 1}画面を比較中
                </Badge>
              ) : null}
              <Button size="sm" variant="outline" onClick={openDialog}>
                <Columns3 aria-hidden="true" className="size-4" />
                他プロジェクトと比較
              </Button>
              {comparing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => writeProjectIds([])}
                >
                  比較を終了
                </Button>
              ) : null}
            </>,
            props.headerActionsContainer,
          )
        : null}

      {comparing ? (
        <div
          aria-label="プロジェクト比較タイムライン"
          className="styled-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border bg-muted/30"
          data-project-order={projectIds.join(",")}
          data-testid="timeline-comparison-stack"
        >
          <section
            aria-label={`${props.project.name}のタイムライン`}
            className="flex min-h-64 shrink-0 flex-col border-b bg-background"
            style={{ height: paneHeight }}
          >
            <TimelineWorkspace
              key={`comparison-${props.project.id}`}
              {...props}
              fixedLayoutMode
              layoutMode="compact"
              lazyLoadSupplementalData
              readOnly
              hideFooter
              seamless
              timelineDomain={domain}
              timelineStore={sharedStore}
            />
          </section>
          {projectIds.map((projectId, index) => {
            const query =
              projectQueriesById.get(projectId) ?? projectQueries[index];
            const dataset =
              query?.data?.project.id === projectId ? query.data : undefined;
            const projectPending =
              query?.isPending || (query?.data !== undefined && !dataset);
            return (
              <section
                key={projectId}
                aria-label={`${dataset?.project.name ?? "比較対象"}のタイムライン`}
                className="flex min-h-64 shrink-0 flex-col border-b bg-background last:border-b-0"
                style={{ height: paneHeight }}
              >
                {projectPending ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    タイムラインを読み込んでいます…
                  </div>
                ) : query?.isError || !dataset ? (
                  <div
                    className="flex flex-1 items-center justify-center text-sm text-destructive"
                    role="alert"
                  >
                    このプロジェクトのタイムラインを読み込めませんでした。
                  </div>
                ) : (
                  <TimelineWorkspace
                    currentDate={props.currentDate}
                    fixedLayoutMode
                    filters={props.filters}
                    initialBackgroundLayers={[]}
                    initialEvents={dataset.events}
                    initialItems={dataset.items}
                    initialRelationships={EMPTY_RELATIONSHIPS}
                    itemTypes={dataset.itemTypes}
                    layoutMode="compact"
                    project={dataset.project}
                    readOnly
                    hideAxisHeader
                    hideFooter
                    hideToolbar
                    seamless
                    timelineDomain={domain}
                    timelineStore={sharedStore}
                  />
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <TimelineWorkspace
          {...props}
          lazyLoadSupplementalData
          timelineStore={sharedStore}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>他プロジェクトと比較</DialogTitle>
            <DialogDescription>
              所有プロジェクトまたは閲覧可能な公開プロジェクトを複数選択できます。
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="比較するプロジェクトを検索"
            placeholder="プロジェクト名・説明で検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {selectedProjects.length > 0 ? (
            <section aria-labelledby="comparison-order-heading">
              <h3
                className="mb-2 text-sm font-medium"
                id="comparison-order-heading"
              >
                表示順
              </h3>
              <DndContext
                collisionDetection={closestCenter}
                sensors={comparisonSensors}
                onDragEnd={handleComparisonDragEnd}
              >
                <SortableContext
                  items={draftIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    className="space-y-1"
                    data-draft-order={draftIds.join(",")}
                    data-testid="comparison-selected-projects"
                  >
                    {selectedProjects.map((candidate) => (
                      <SortableComparisonProject
                        key={candidate.id}
                        project={candidate}
                        onRemove={() =>
                          setDraftIds((current) => {
                            return current.filter(
                              (projectId) => projectId !== candidate.id,
                            );
                          })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </section>
          ) : null}
          <div className="styled-scrollbar max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
            {projectsLoading ? (
              <p className="p-3 text-sm text-muted-foreground">
                検索対象を読み込んでいます…
              </p>
            ) : filteredProjects.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                選択できるプロジェクトがありません。
              </p>
            ) : (
              filteredProjects.map((candidate) => (
                <label
                  key={candidate.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"
                >
                  <input
                    className="mt-1 size-4 accent-primary"
                    type="checkbox"
                    checked={false}
                    onChange={() =>
                      setDraftIds((current) => {
                        return [...current, candidate.id];
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {candidate.name}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {candidate.description ??
                        (candidate.access === "owned"
                          ? "所有プロジェクト"
                          : "公開プロジェクト")}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">キャンセル</Button>
            </DialogClose>
            <Button
              onClick={() => {
                writeProjectIds(draftIds);
                setDialogOpen(false);
              }}
            >
              {draftIds.length > 0
                ? `${draftIds.length}件を比較`
                : "比較を終了"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
