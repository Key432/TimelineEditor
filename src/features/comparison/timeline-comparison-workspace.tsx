"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { Columns3, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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
  replaceComparedProject,
} from "@/features/comparison/comparison-layout";
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
};

export function TimelineComparisonWorkspace(
  props: TimelineComparisonWorkspaceProps,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [sharedStore] = useState(() =>
    createTimelineStore(props.project.settings),
  );
  const projectIds = useMemo(
    () =>
      Array.from(new Set(searchParams.getAll("compare"))).filter(
        (projectId) => projectId !== props.project.id,
      ),
    [props.project.id, searchParams],
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
      (!normalizedSearch ||
        candidate.name.toLocaleLowerCase("ja").includes(normalizedSearch) ||
        candidate.description
          ?.toLocaleLowerCase("ja")
          .includes(normalizedSearch)),
  );

  function writeProjectIds(nextIds: string[]) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("compare");
    for (const projectId of nextIds) next.append("compare", projectId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function openDialog() {
    setDraftIds(projectIds);
    setSearch("");
    setDialogOpen(true);
  }

  const paneHeight = comparisonPaneHeight(projectIds.length + 1);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-end gap-2">
        {comparing ? (
          <Badge variant="secondary">{projectIds.length + 1}画面を比較中</Badge>
        ) : null}
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Columns3 aria-hidden="true" className="size-4" />
          他プロジェクトと比較
        </Button>
        {comparing ? (
          <Button size="sm" variant="ghost" onClick={() => writeProjectIds([])}>
            比較を終了
          </Button>
        ) : null}
      </div>

      {comparing ? (
        <div
          aria-label="プロジェクト比較タイムライン"
          className="styled-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border bg-muted/30"
          data-testid="timeline-comparison-stack"
        >
          <section
            aria-label={`${props.project.name}のタイムライン`}
            className="flex min-h-64 shrink-0 flex-col gap-2 border-b bg-background p-2"
            style={{ height: paneHeight }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2">
              <h2 className="truncate text-sm font-semibold">
                {props.project.name}
              </h2>
              <Badge variant="outline">基準プロジェクト</Badge>
            </div>
            <TimelineWorkspace
              key={`comparison-${props.project.id}`}
              {...props}
              fixedLayoutMode
              layoutMode="compact"
              lazyLoadSupplementalData
              readOnly
              timelineDomain={domain}
              timelineStore={sharedStore}
            />
          </section>
          {projectIds.map((projectId, index) => {
            const query = projectQueries[index];
            const dataset = query?.data;
            return (
              <section
                key={projectId}
                aria-label={`${dataset?.project.name ?? "比較対象"}のタイムライン`}
                className="flex min-h-64 shrink-0 flex-col gap-2 border-b bg-background p-2 last:border-b-0"
                style={{ height: paneHeight }}
              >
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    aria-label={`比較画面${index + 2}のプロジェクト`}
                    className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                    value={projectId}
                    onChange={(event) =>
                      writeProjectIds(
                        replaceComparedProject(
                          projectIds,
                          index,
                          event.target.value,
                        ),
                      )
                    }
                  >
                    {projects.map((candidate) => (
                      <option
                        key={candidate.id}
                        disabled={
                          candidate.id === props.project.id ||
                          (candidate.id !== projectId &&
                            projectIds.includes(candidate.id))
                        }
                        value={candidate.id}
                      >
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    aria-label={`${dataset?.project.name ?? "比較画面"}を比較から外す`}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() =>
                      writeProjectIds(
                        projectIds.filter(
                          (candidateId) => candidateId !== projectId,
                        ),
                      )
                    }
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                {query?.isPending ? (
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
                    timelineDomain={domain}
                    timelineStore={sharedStore}
                  />
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <TimelineWorkspace {...props} lazyLoadSupplementalData />
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
                    checked={draftIds.includes(candidate.id)}
                    onChange={(event) =>
                      setDraftIds((current) =>
                        event.target.checked
                          ? [...current, candidate.id]
                          : current.filter(
                              (projectId) => projectId !== candidate.id,
                            ),
                      )
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
