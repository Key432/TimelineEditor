"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  CalendarSearch,
  Expand,
  Maximize,
  Save,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  historicalDateFromOrdinal,
  historicalDateOrdinal,
} from "@/features/timeline-items/historical-date";
import type { TimelineFilters } from "@/features/timeline-items/timeline-filters";
import { useTimelineStore } from "@/features/timeline-items/timeline-store";
import type {
  TimelineLayoutMode,
  TimelineSortMode,
} from "@/features/timeline-items/types";
import {
  createTimelineSavedView,
  deleteTimelineSavedView,
  listTimelineSavedViews,
  timelineSavedViewKeys,
  updateTimelineSavedView,
} from "@/features/timeline-views/api";
import type {
  TimelineSavedView,
  TimelineViewConfiguration,
} from "@/features/timeline-views/types";

type Props = {
  projectId: string;
  filters: TimelineFilters;
  sortMode: TimelineSortMode;
  sortDirection: "asc" | "desc";
  groupByType: boolean;
  layoutMode: TimelineLayoutMode;
  isMaximized: boolean;
  fullscreenSupported: boolean;
  canSaveViews: boolean;
  onFiltersChange?: (filters: TimelineFilters) => void;
  onSortChange: (mode: TimelineSortMode, direction: "asc" | "desc") => void;
  onGroupByTypeChange: (grouped: boolean) => void;
  onLayoutModeChange?: (mode: TimelineLayoutMode) => void;
  onToggleMaximized: () => void;
  onToggleFullscreen: () => void;
};

export function TimelineViewControls(props: Props) {
  const queryClient = useQueryClient();
  const viewport = useTimelineStore((state) => state.viewport);
  const zoomLevel = useTimelineStore((state) => state.zoomLevel);
  const scrollLeft = useTimelineStore((state) => state.scrollLeft);
  const density = useTimelineStore((state) => state.density);
  const setZoomLevel = useTimelineStore((state) => state.setZoomLevel);
  const setDensity = useTimelineStore((state) => state.setDensity);
  const navigateTo = useTimelineStore((state) => state.navigateTo);
  const [jumpYear, setJumpYear] = useState("");
  const [bookmarks, setBookmarks] = useState<
    Array<{ id: string; label: string; ordinal: number }>
  >([]);
  const [viewName, setViewName] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const views = useQuery({
    queryKey: timelineSavedViewKeys.list(props.projectId),
    queryFn: () => listTimelineSavedViews(props.projectId),
    enabled: props.canSaveViews,
  });

  const configuration = useMemo<TimelineViewConfiguration | null>(
    () =>
      viewport
        ? {
            version: 1,
            visibleStartOrdinal: viewport.visibleStartOrdinal,
            visibleEndOrdinal: viewport.visibleEndOrdinal,
            zoomLevel,
            scrollLeft,
            filters: props.filters,
            sortMode: props.sortMode,
            sortDirection: props.sortDirection,
            groupByType: props.groupByType,
            layoutMode: props.layoutMode,
            density,
            tags: [],
            backgroundLayerIds: [],
            showRelationships: false,
            visibleColumns: [],
          }
        : null,
    [
      density,
      props.filters,
      props.groupByType,
      props.layoutMode,
      props.sortDirection,
      props.sortMode,
      scrollLeft,
      viewport,
      zoomLevel,
    ],
  );

  const saveMutation = useMutation({
    mutationFn: ({ existing }: { existing?: TimelineSavedView }) => {
      if (!configuration) throw new Error("表示位置を取得できません。");
      const name = (existing?.name ?? viewName).trim();
      if (!name) throw new Error("ビュー名を入力してください。");
      return existing
        ? updateTimelineSavedView(
            props.projectId,
            existing.id,
            name,
            configuration,
          )
        : createTimelineSavedView(props.projectId, name, configuration);
    },
    onSuccess: () => {
      setViewName("");
      setViewMenuOpen(false);
      setError(null);
      void queryClient.invalidateQueries({
        queryKey: timelineSavedViewKeys.list(props.projectId),
      });
    },
    onError: (mutationError) => setError(mutationError.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (view: TimelineSavedView) =>
      deleteTimelineSavedView(props.projectId, view.id),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: timelineSavedViewKeys.list(props.projectId),
      }),
  });

  function applyView(view: TimelineSavedView) {
    const value = view.configuration;
    setZoomLevel(value.zoomLevel);
    setDensity(value.density);
    props.onFiltersChange?.(value.filters);
    props.onSortChange(value.sortMode, value.sortDirection);
    props.onGroupByTypeChange(value.groupByType);
    props.onLayoutModeChange?.(value.layoutMode);
    navigateTo((value.visibleStartOrdinal + value.visibleEndOrdinal) / 2);
  }

  return (
    <>
      <Button
        aria-pressed={props.isMaximized}
        size="sm"
        variant="outline"
        onClick={props.onToggleMaximized}
      >
        <Expand aria-hidden="true" className="size-4" />
        {props.isMaximized ? "元の大きさ" : "最大化"}
      </Button>
      {props.fullscreenSupported ? (
        <Button size="sm" variant="outline" onClick={props.onToggleFullscreen}>
          <Maximize aria-hidden="true" className="size-4" />
          全画面
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <CalendarSearch aria-hidden="true" className="size-4" />
            年代へ移動
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-2" align="start">
          <DropdownMenuLabel>西暦年へ移動</DropdownMenuLabel>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const year = Number(jumpYear);
              if (Number.isInteger(year) && year >= 1)
                navigateTo(historicalDateOrdinal({ year, month: 1, day: 1 }));
            }}
          >
            <Input
              aria-label="移動先の年"
              className="h-8"
              min={1}
              placeholder="例: 1868"
              type="number"
              value={jumpYear}
              onChange={(event) => setJumpYear(event.target.value)}
            />
            <Button size="sm" type="submit">
              移動
            </Button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Bookmark aria-hidden="true" className="size-4" />
            位置
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-64" align="start">
          <DropdownMenuItem
            disabled={!viewport}
            onSelect={() => {
              if (!viewport) return;
              const ordinal =
                (viewport.visibleStartOrdinal + viewport.visibleEndOrdinal) / 2;
              setBookmarks((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  ordinal,
                  label: historicalDateFromOrdinal(ordinal).year + "年付近",
                },
              ]);
            }}
          >
            現在位置をブックマーク
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {bookmarks.length === 0 ? (
            <DropdownMenuItem disabled>
              ブックマークはありません
            </DropdownMenuItem>
          ) : (
            bookmarks.map((bookmark) => (
              <DropdownMenuItem
                key={bookmark.id}
                onSelect={() => navigateTo(bookmark.ordinal)}
              >
                {bookmark.label}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {props.canSaveViews ? (
        <DropdownMenu open={viewMenuOpen} onOpenChange={setViewMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Save aria-hidden="true" className="size-4" />
              保存済みビュー
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 p-2" align="start">
            <DropdownMenuLabel>現在の表示を保存</DropdownMenuLabel>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate({});
              }}
            >
              <Input
                aria-label="保存済みビュー名"
                className="h-8"
                maxLength={80}
                placeholder="ビュー名"
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
              />
              <Button
                disabled={saveMutation.isPending || !configuration}
                size="sm"
                type="submit"
              >
                保存
              </Button>
            </form>
            {error ? (
              <p className="px-2 pt-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DropdownMenuSeparator />
            {views.isLoading ? (
              <DropdownMenuItem disabled>読み込み中...</DropdownMenuItem>
            ) : views.data?.length ? (
              views.data.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-1 rounded-sm hover:bg-accent"
                >
                  <DropdownMenuItem
                    className="flex-1"
                    onSelect={() => applyView(view)}
                  >
                    {view.name}
                  </DropdownMenuItem>
                  <Button
                    aria-label={`${view.name}を上書き`}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => saveMutation.mutate({ existing: view })}
                  >
                    <Save aria-hidden="true" className="size-3.5" />
                  </Button>
                  <Button
                    aria-label={`${view.name}を削除`}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`「${view.name}」を削除しますか？`))
                        deleteMutation.mutate(view);
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
              ))
            ) : (
              <DropdownMenuItem disabled>
                保存済みビューはありません
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}
