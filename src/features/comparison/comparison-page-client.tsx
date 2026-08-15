"use client";

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Minus, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  comparisonKeys,
  createComparisonSavedView,
  deleteComparisonSavedView,
  loadComparisonProject,
  updateComparisonSavedView,
} from "@/features/comparison/api";
import type {
  ComparisonDataset,
  ComparisonProjectOption,
  ComparisonSavedView,
  ComparisonViewConfiguration,
} from "@/features/comparison/types";
import {
  astronomicalYear,
  formatHistoricalDate,
  historicalDateFromOrdinal,
  historicalDateOrdinal,
} from "@/features/timeline-items/historical-date";
import { generateTimelineTicks } from "@/features/timeline-items/timeline-math";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

const ZOOM_SCALES = [0.002, 0.006, 0.018, 0.05, 0.15] as const;

function queryList(params: URLSearchParams, key: string) {
  return params.getAll(key).filter(Boolean);
}

function signedYearToDate(value: number) {
  const year = value === 0 ? 1 : value;
  return year < 0
    ? { era: "bce" as const, year: Math.abs(year), month: 1, day: 1 }
    : { era: "ce" as const, year, month: 1, day: 1 };
}

function ordinalToSignedYear(ordinal: number) {
  const date = historicalDateFromOrdinal(ordinal);
  return astronomicalYear(date.era ?? "ce", date.year);
}

function yearOrdinal(value: number, boundary: "start" | "end") {
  const date = signedYearToDate(value);
  return historicalDateOrdinal(
    boundary === "start" ? date : { ...date, month: 12, day: 31 },
    boundary,
  );
}

function replaceList(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);
  values.forEach((value) => params.append(key, value));
}

function itemBounds(item: TimelineItemSummary, endOrdinal: number) {
  const startDate = item.temporalType === "point" ? item.point : item.start;
  if (!startDate) return null;
  const start = historicalDateOrdinal(startDate);
  if (item.temporalType === "point") return { start, end: start };
  if (item.endDateStatus === "ongoing") return { start, end: endOrdinal };
  const endDate = item.end ?? item.lastConfirmed ?? item.start;
  return {
    start,
    end: endDate ? historicalDateOrdinal(endDate, "end") : start,
  };
}

function detailHref(
  dataset: ComparisonDataset,
  kind: "items" | "events",
  id: string,
) {
  return dataset.project.access === "owned"
    ? `/projects/${dataset.project.id}/${kind}/${id}`
    : `/public/${dataset.project.publicId}/${kind}/${id}`;
}

export function ComparisonPageClient({
  projects,
  initialViews,
}: {
  projects: ComparisonProjectOption[];
  initialViews: ComparisonSavedView[];
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const params = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );
  const selectedIds =
    queryList(params, "project").length > 0
      ? queryList(params, "project")
          .filter((id) => projects.some((project) => project.id === id))
          .slice(0, 6)
      : projects.slice(0, 2).map((project) => project.id);
  const hiddenIds = queryList(params, "hidden").filter((id) =>
    selectedIds.includes(id),
  );
  const fromYear = Number(params.get("from") ?? -500) || -500;
  const toYear = Number(params.get("to") ?? 2050) || 2050;
  const startOrdinal = yearOrdinal(Math.min(fromYear, toYear), "start");
  const endOrdinal = yearOrdinal(Math.max(fromYear, toYear), "end");
  const zoomLevel = Math.max(
    0,
    Math.min(4, Number(params.get("zoom") ?? 1) || 0),
  );
  const highlightFrom = params.has("highlightFrom")
    ? Number(params.get("highlightFrom"))
    : null;
  const highlightTo = params.has("highlightTo")
    ? Number(params.get("highlightTo"))
    : null;
  const typeNames = queryList(params, "type");
  const tagNames = queryList(params, "tag");
  const eventTypeNames = queryList(params, "eventType");
  const [viewName, setViewName] = useState("");
  const [activeViewId, setActiveViewId] = useState("");
  const [message, setMessage] = useState("");

  const queries = useQueries({
    queries: selectedIds.map((projectId) => ({
      queryKey: comparisonKeys.project(projectId, startOrdinal, endOrdinal),
      queryFn: () => loadComparisonProject(projectId, startOrdinal, endOrdinal),
      staleTime: 30_000,
    })),
  });
  const datasets = queries.flatMap((query) => (query.data ? [query.data] : []));
  const views =
    queryClient.getQueryData<ComparisonSavedView[]>(comparisonKeys.views) ??
    initialViews;

  function navigate(next: URLSearchParams) {
    window.history.replaceState(null, "", `/compare?${next.toString()}`);
  }

  function currentParams() {
    return new URLSearchParams(window.location.search);
  }

  function setList(key: string, values: string[]) {
    const next = currentParams();
    replaceList(next, key, values);
    navigate(next);
  }

  const configuration: ComparisonViewConfiguration = {
    version: 1,
    projectIds: selectedIds,
    hiddenProjectIds: hiddenIds,
    visibleStartOrdinal: startOrdinal,
    visibleEndOrdinal: endOrdinal,
    zoomLevel,
    highlightStartOrdinal:
      highlightFrom === null ? null : yearOrdinal(highlightFrom, "start"),
    highlightEndOrdinal:
      highlightTo === null ? null : yearOrdinal(highlightTo, "end"),
    filters: { tagNames, typeNames, eventTypeNames },
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      activeViewId
        ? updateComparisonSavedView(activeViewId, viewName, configuration)
        : createComparisonSavedView(viewName, configuration),
    onSuccess: (view) => {
      queryClient.setQueryData<ComparisonSavedView[]>(
        comparisonKeys.views,
        (current = initialViews) => [
          view,
          ...current.filter((entry) => entry.id !== view.id),
        ],
      );
      setActiveViewId(view.id);
      setViewName(view.name);
      setMessage("比較条件を保存しました。");
    },
    onError: (error) =>
      setMessage(
        error instanceof Error ? error.message : "保存できませんでした。",
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteComparisonSavedView(activeViewId),
    onSuccess: () => {
      queryClient.setQueryData<ComparisonSavedView[]>(
        comparisonKeys.views,
        (current = initialViews) =>
          current.filter((entry) => entry.id !== activeViewId),
      );
      setActiveViewId("");
      setViewName("");
      setMessage("保存済み比較ビューを削除しました。");
    },
  });

  function applyView(view: ComparisonSavedView) {
    const config = view.configuration;
    const next = new URLSearchParams();
    replaceList(
      next,
      "project",
      config.projectIds.filter((id) =>
        projects.some((project) => project.id === id),
      ),
    );
    replaceList(next, "hidden", config.hiddenProjectIds);
    next.set("from", String(ordinalToSignedYear(config.visibleStartOrdinal)));
    next.set("to", String(ordinalToSignedYear(config.visibleEndOrdinal)));
    next.set("zoom", String(config.zoomLevel));
    if (config.highlightStartOrdinal !== null)
      next.set(
        "highlightFrom",
        String(ordinalToSignedYear(config.highlightStartOrdinal)),
      );
    if (config.highlightEndOrdinal !== null)
      next.set(
        "highlightTo",
        String(ordinalToSignedYear(config.highlightEndOrdinal)),
      );
    replaceList(next, "tag", config.filters.tagNames);
    replaceList(next, "type", config.filters.typeNames);
    replaceList(next, "eventType", config.filters.eventTypeNames);
    setActiveViewId(view.id);
    setViewName(view.name);
    navigate(next);
  }

  const allTypeNames = [
    ...new Set(
      datasets.flatMap((dataset) => dataset.itemTypes.map((type) => type.name)),
    ),
  ].sort();
  const allTagNames = [
    ...new Set(
      datasets.flatMap((dataset) => [
        ...dataset.items.flatMap(
          (item) => item.tags?.map((tag) => tag.name) ?? [],
        ),
        ...dataset.events.flatMap(
          (event) => event.tags?.map((tag) => tag.name) ?? [],
        ),
      ]),
    ),
  ].sort();
  const allEventTypeNames = [
    ...new Set(
      datasets.flatMap((dataset) =>
        dataset.events.flatMap((event) =>
          event.eventType ? [event.eventType.name] : [],
        ),
      ),
    ),
  ].sort();
  const span = Math.max(1, endOrdinal - startOrdinal);
  const contentWidth = Math.max(
    900,
    Math.min(100_000, span * ZOOM_SCALES[zoomLevel]!),
  );
  const scale = contentWidth / span;
  const ticks = generateTimelineTicks(
    startOrdinal,
    endOrdinal,
    scale,
    "day",
  ).ticks;
  const highlightStartOrdinal =
    highlightFrom === null ? null : yearOrdinal(highlightFrom, "start");
  const highlightEndOrdinal =
    highlightTo === null ? null : yearOrdinal(highlightTo, "end");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            プロジェクト横断比較
          </h1>
          <p className="text-sm text-muted-foreground">
            複数の年表を同じ時間軸で比較します。比較画面は閲覧専用です。
          </p>
        </div>
        <Badge variant="secondary">
          <Eye aria-hidden="true" />
          閲覧専用
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">比較条件</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 xl:grid-cols-[1.2fr_1fr_1fr]">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              プロジェクト（最大6件）
            </legend>
            <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border p-3">
              {projects.map((project) => {
                const selected = selectedIds.includes(project.id);
                return (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={project.id}
                  >
                    <input
                      checked={selected}
                      className="size-4 accent-primary"
                      disabled={!selected && selectedIds.length >= 6}
                      type="checkbox"
                      onChange={(event) =>
                        setList(
                          "project",
                          event.target.checked
                            ? [...selectedIds, project.id]
                            : selectedIds.filter((id) => id !== project.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {project.name}
                    </span>
                    <Badge variant="outline">
                      {project.access === "owned" ? "所有" : "公開"}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 content-start gap-3">
            <YearField
              label="表示開始年"
              value={fromYear}
              onCommit={(value) => {
                const next = currentParams();
                next.set("from", String(value));
                navigate(next);
              }}
            />
            <YearField
              label="表示終了年"
              value={toYear}
              onCommit={(value) => {
                const next = currentParams();
                next.set("to", String(value));
                navigate(next);
              }}
            />
            <YearField
              label="強調開始年"
              optional
              value={highlightFrom}
              onCommit={(value) => {
                const next = currentParams();
                if (value === null) next.delete("highlightFrom");
                else next.set("highlightFrom", String(value));
                navigate(next);
              }}
            />
            <YearField
              label="強調終了年"
              optional
              value={highlightTo}
              onCommit={(value) => {
                const next = currentParams();
                if (value === null) next.delete("highlightTo");
                else next.set("highlightTo", String(value));
                navigate(next);
              }}
            />
            <div className="col-span-2 flex items-center gap-2">
              <Button
                aria-label="縮小"
                disabled={zoomLevel === 0}
                size="icon"
                variant="outline"
                onClick={() => {
                  const next = currentParams();
                  next.set("zoom", String(zoomLevel - 1));
                  navigate(next);
                }}
              >
                <Minus />
              </Button>
              <span className="min-w-20 text-center text-sm">
                ズーム {zoomLevel + 1}
              </span>
              <Button
                aria-label="拡大"
                disabled={zoomLevel === 4}
                size="icon"
                variant="outline"
                onClick={() => {
                  const next = currentParams();
                  next.set("zoom", String(zoomLevel + 1));
                  navigate(next);
                }}
              >
                <Plus />
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <Label htmlFor="comparison-saved-view">保存済みビュー</Label>
            <select
              id="comparison-saved-view"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={activeViewId}
              onChange={(event) => {
                const view = views.find(
                  (entry) => entry.id === event.target.value,
                );
                if (view) applyView(view);
                else {
                  setActiveViewId("");
                  setViewName("");
                }
              }}
            >
              <option value="">新規ビュー</option>
              {views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
            <Input
              aria-label="比較ビュー名"
              maxLength={80}
              placeholder="比較ビュー名"
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
            <div className="flex gap-2">
              <Button
                disabled={
                  !viewName.trim() ||
                  selectedIds.length === 0 ||
                  saveMutation.isPending
                }
                onClick={() => saveMutation.mutate()}
              >
                <Save />
                {activeViewId ? "更新" : "保存"}
              </Button>
              <Button
                aria-label="保存済み比較ビューを削除"
                disabled={!activeViewId || deleteMutation.isPending}
                variant="outline"
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 />
              </Button>
            </div>
            {message ? (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <NameFilters
            label="タイムライン種別"
            names={allTypeNames}
            selected={typeNames}
            onChange={(values) => setList("type", values)}
          />
          <NameFilters
            label="タグ"
            names={allTagNames}
            selected={tagNames}
            onChange={(values) => setList("tag", values)}
          />
          <NameFilters
            label="イベント種別"
            names={allEventTypeNames}
            selected={eventTypeNames}
            onChange={(values) => setList("eventType", values)}
          />
        </CardContent>
      </Card>

      {selectedIds.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          比較するプロジェクトを選択してください。
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border bg-card"
          aria-label="共通時間軸。横スクロールでパンできます。"
        >
          <div className="relative" style={{ width: contentWidth }}>
            <div className="sticky top-0 z-20 h-12 border-b bg-card/95">
              {ticks.map((tick) => (
                <div
                  className="absolute top-0 h-full border-l text-[11px] text-muted-foreground"
                  key={tick.ordinal}
                  style={{ left: (tick.ordinal - startOrdinal) * scale }}
                >
                  <span className="ml-1 whitespace-nowrap">{tick.label}</span>
                </div>
              ))}
            </div>
            {highlightStartOrdinal !== null &&
            highlightEndOrdinal !== null &&
            highlightEndOrdinal >= highlightStartOrdinal ? (
              <div
                aria-label={`${highlightFrom}年から${highlightTo}年を強調`}
                className="pointer-events-none absolute top-0 bottom-0 z-0 bg-secondary/10"
                style={{
                  left: Math.max(
                    0,
                    (highlightStartOrdinal - startOrdinal) * scale,
                  ),
                  width: Math.max(
                    2,
                    (highlightEndOrdinal - highlightStartOrdinal) * scale,
                  ),
                }}
              />
            ) : null}
            {queries.map((query, index) => {
              const projectId = selectedIds[index]!;
              const fallback = projects.find(
                (project) => project.id === projectId,
              )!;
              if (query.isPending)
                return (
                  <div
                    className="h-32 animate-pulse border-b bg-muted/30 p-3"
                    key={projectId}
                  >
                    {fallback.name} を取得中…
                  </div>
                );
              if (query.error || !query.data)
                return (
                  <div
                    className="h-32 border-b p-3 text-destructive"
                    key={projectId}
                  >
                    {fallback.name} を取得できませんでした。
                  </div>
                );
              return (
                <ProjectLane
                  dataset={query.data}
                  endOrdinal={endOrdinal}
                  hidden={hiddenIds.includes(projectId)}
                  key={projectId}
                  scale={scale}
                  startOrdinal={startOrdinal}
                  tagNames={tagNames}
                  typeNames={typeNames}
                  eventTypeNames={eventTypeNames}
                  onToggle={() =>
                    setList(
                      "hidden",
                      hiddenIds.includes(projectId)
                        ? hiddenIds.filter((id) => id !== projectId)
                        : [...hiddenIds, projectId],
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        年は正数が西暦、負数が紀元前です（例: -1 =
        紀元前1年）。横スクロールが全プロジェクト共通のパン操作です。
      </p>
    </div>
  );
}

function YearField({
  label,
  value,
  optional = false,
  onCommit,
}: {
  label: string;
  value: number | null;
  optional?: boolean;
  onCommit: (value: number | null) => void;
}) {
  function commit(raw: string) {
    if (!raw && optional) onCommit(null);
    else if (raw && Number(raw) !== 0 && Number.isInteger(Number(raw)))
      onCommit(Number(raw));
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        aria-label={label}
        defaultValue={value ?? ""}
        key={value ?? "empty"}
        type="number"
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
      />
    </div>
  );
}

function NameFilters({
  label,
  names,
  selected,
  onChange,
}: {
  label: string;
  names: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border p-2">
        {names.length === 0 ? (
          <span className="text-xs text-muted-foreground">候補なし</span>
        ) : (
          names.map((name) => (
            <label className="flex items-center gap-2 text-sm" key={name}>
              <input
                checked={selected.includes(name)}
                className="accent-primary"
                type="checkbox"
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, name]
                      : selected.filter((entry) => entry !== name),
                  )
                }
              />
              {name}
            </label>
          ))
        )}
      </div>
    </fieldset>
  );
}

function ProjectLane({
  dataset,
  hidden,
  startOrdinal,
  endOrdinal,
  scale,
  typeNames,
  tagNames,
  eventTypeNames,
  onToggle,
}: {
  dataset: ComparisonDataset;
  hidden: boolean;
  startOrdinal: number;
  endOrdinal: number;
  scale: number;
  typeNames: string[];
  tagNames: string[];
  eventTypeNames: string[];
  onToggle: () => void;
}) {
  const items = dataset.items.filter(
    (item) =>
      (typeNames.length === 0 || typeNames.includes(item.itemType.name)) &&
      (tagNames.length === 0 ||
        item.tags?.some((tag) => tagNames.includes(tag.name)) ||
        dataset.events.some(
          (event) =>
            event.timelineItemIds.includes(item.id) &&
            event.tags?.some((tag) => tagNames.includes(tag.name)),
        )),
  );
  const itemIds = new Set(items.map((item) => item.id));
  const events = dataset.events.filter(
    (event) =>
      itemIds.size > 0 &&
      event.timelineItemIds.some((id) => itemIds.has(id)) &&
      (eventTypeNames.length === 0 ||
        (event.eventType && eventTypeNames.includes(event.eventType.name))) &&
      (tagNames.length === 0 ||
        event.tags?.some((tag) => tagNames.includes(tag.name))),
  );
  return (
    <section
      className="relative h-32 border-b last:border-b-0"
      aria-label={dataset.project.name}
    >
      <div className="sticky left-0 z-10 flex h-full w-52 flex-col gap-2 border-r bg-card/95 p-3 shadow-sm">
        <div className="flex items-start gap-2">
          <h2 className="line-clamp-2 flex-1 text-sm font-semibold">
            {dataset.project.name}
          </h2>
          <Button
            aria-label={
              hidden
                ? `${dataset.project.name}を表示`
                : `${dataset.project.name}を非表示`
            }
            size="icon"
            variant="ghost"
            onClick={onToggle}
          >
            {hidden ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        <Badge className="w-fit" variant="outline">
          {dataset.project.access === "owned" ? "所有" : "公開"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {items.length} 項目 / {events.length} イベント
        </span>
      </div>
      {!hidden ? (
        <div className="absolute inset-y-0 left-0">
          {items.map((item, index) => {
            const bounds = itemBounds(item, endOrdinal);
            if (!bounds) return null;
            const left = Math.max(0, (bounds.start - startOrdinal) * scale);
            const width = Math.max(
              10,
              (Math.min(endOrdinal, bounds.end) -
                Math.max(startOrdinal, bounds.start)) *
                scale,
            );
            return (
              <Link
                className="absolute z-[2] h-6 overflow-hidden rounded border px-1 text-[11px] leading-5 whitespace-nowrap hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:outline-none"
                href={detailHref(dataset, "items", item.id)}
                key={item.id}
                rel="noopener noreferrer"
                style={{
                  left,
                  top: 30 + (index % 3) * 25,
                  width,
                  minWidth: 10,
                  backgroundColor: `${item.colorOverride ?? item.itemType.defaultColor}33`,
                  borderColor: item.colorOverride ?? item.itemType.defaultColor,
                }}
                target="_blank"
                title={`${item.title}（詳細を新しいタブで開く）`}
              >
                {item.title}
              </Link>
            );
          })}
          {events.map((event) => {
            const left =
              (historicalDateOrdinal(event.date) - startOrdinal) * scale;
            return (
              <Link
                aria-label={`${event.title}の詳細を新しいタブで開く`}
                className="absolute top-[104px] z-[3] size-3 -translate-x-1/2 rotate-45 border-2 border-card bg-secondary focus-visible:ring-2 focus-visible:outline-none"
                href={detailHref(dataset, "events", event.id)}
                key={event.id}
                rel="noopener noreferrer"
                style={{ left }}
                target="_blank"
                title={`${formatHistoricalDate(event.date)} ${event.title}`}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
