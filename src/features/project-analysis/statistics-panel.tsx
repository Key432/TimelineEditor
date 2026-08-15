"use client";

import { max, sum } from "d3-array";
import { scaleLinear, scaleQuantize } from "d3-scale";
import { arc, pie } from "d3-shape";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type {
  AnalysisEntityLink,
  ProjectStatistics,
  StatisticDatum,
} from "@/features/project-analysis/analysis";

function entityPath(projectId: string, entity: AnalysisEntityLink) {
  return `/projects/${projectId}/${entity.entityType === "timeline_item" ? "items" : "events"}/${entity.id}`;
}

function HorizontalBars({
  data,
  label,
  onOpen,
  limit = 12,
}: {
  data: StatisticDatum[];
  label: string;
  onOpen: (entry: StatisticDatum) => void;
  limit?: number;
}) {
  const shown = data.slice(0, limit);
  const width = scaleLinear()
    .domain([0, max(shown, (entry) => entry.count) ?? 1])
    .range([0, 100]);
  return (
    <section className="space-y-3" aria-label={label}>
      <h3 className="text-sm font-medium">{label}</h3>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          該当データはありません。
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((entry) => (
            <button
              key={entry.key}
              className="group grid w-full grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              disabled={entry.entities.length === 0}
              type="button"
              onClick={() => onOpen(entry)}
            >
              <span className="truncate" title={entry.label}>
                {entry.label}
              </span>
              <span className="h-4 bg-muted" aria-hidden="true">
                <span
                  className="block h-full bg-primary transition-[width] group-hover:bg-primary/80"
                  style={{ width: `${width(entry.count)}%` }}
                />
              </span>
              <span className="w-10 text-right tabular-nums">
                {entry.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function DonutChart({
  data,
  label,
  onOpen,
}: {
  data: StatisticDatum[];
  label: string;
  onOpen: (entry: StatisticDatum) => void;
}) {
  const values = pie<StatisticDatum>()
    .sort(null)
    .value((entry) => entry.count)(data.filter((entry) => entry.count > 0));
  const path = arc<(typeof values)[number]>().innerRadius(42).outerRadius(72);
  const colors = [
    "var(--color-primary)",
    "var(--color-secondary)",
    "var(--color-success)",
    "var(--color-warning)",
    "var(--color-text-muted)",
  ];
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">{label}</h3>
      <div className="flex flex-wrap items-center gap-4">
        <svg
          aria-label={`${label}の円グラフ`}
          className="size-40 shrink-0"
          role="img"
          viewBox="-80 -80 160 160"
        >
          {values.map((value, index) => (
            <path
              key={value.data.key}
              d={path(value) ?? undefined}
              fill={colors[index % colors.length]}
            >
              <title>
                {value.data.label}: {value.data.count}件
              </title>
            </path>
          ))}
          <text
            className="fill-foreground text-[15px] font-medium"
            textAnchor="middle"
            y="5"
          >
            {sum(data, (entry) => entry.count)}件
          </text>
        </svg>
        <ul className="min-w-40 space-y-1 text-sm">
          {data.map((entry, index) => (
            <li key={entry.key}>
              <button
                className="flex w-full items-center justify-between gap-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                disabled={entry.entities.length === 0}
                type="button"
                onClick={() => onOpen(entry)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5"
                    style={{ backgroundColor: colors[index % colors.length] }}
                    aria-hidden="true"
                  />
                  {entry.label}
                </span>
                <span className="tabular-nums">{entry.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CreationHeatmap({
  data,
}: {
  data: ProjectStatistics["creationActivity"];
}) {
  const first = new Date(`${data[0]?.date ?? "1970-01-01"}T00:00:00Z`);
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const totals = data.map((entry) => entry.itemCount + entry.eventCount);
  const color = scaleQuantize<string>()
    .domain([1, max(totals) ?? 1])
    .range([
      "var(--color-primary-subtle)",
      "var(--color-primary-soft)",
      "var(--color-primary)",
      "var(--color-primary-hover)",
      "var(--color-primary-active)",
    ]);
  const cells = data.map((entry) => {
    const date = new Date(`${entry.date}T00:00:00Z`);
    const dayOffset = Math.round(
      (date.getTime() - gridStart.getTime()) / 86_400_000,
    );
    return {
      ...entry,
      week: Math.floor(dayOffset / 7),
      weekday: date.getUTCDay(),
    };
  });
  const weeks = (max(cells, (entry) => entry.week) ?? 0) + 1;
  const monthLabels = cells.filter((entry, index) => {
    if (entry.weekday !== 0) return false;
    const current = new Date(`${entry.date}T00:00:00Z`).getUTCMonth();
    const previous =
      index >= 7
        ? new Date(`${cells[index - 7]!.date}T00:00:00Z`).getUTCMonth()
        : -1;
    return current !== previous;
  });
  const monthNames = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ];
  const cell = 11;
  const gap = 3;
  const left = 30;
  const top = 20;
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">作成アクティビティ</h3>
        <p className="text-xs text-muted-foreground">
          直近1年間の日別タイムラインアイテム・イベントアイテム作成数
        </p>
      </div>
      <div className="styled-scrollbar overflow-x-auto pb-2">
        <svg
          aria-label="直近1年間の作成数ヒートマップ"
          className="h-[130px] min-w-max"
          role="img"
          viewBox={`0 0 ${left + weeks * (cell + gap)} 130`}
          width={left + weeks * (cell + gap)}
        >
          {monthLabels.map((entry) => {
            const month = new Date(`${entry.date}T00:00:00Z`).getUTCMonth();
            return (
              <text
                key={entry.date}
                className="fill-muted-foreground text-[10px]"
                x={left + entry.week * (cell + gap)}
                y="10"
              >
                {monthNames[month]}
              </text>
            );
          })}
          {[
            { day: 1, label: "月" },
            { day: 3, label: "水" },
            { day: 5, label: "金" },
          ].map((entry) => (
            <text
              key={entry.day}
              className="fill-muted-foreground text-[10px]"
              x="0"
              y={top + entry.day * (cell + gap) + 9}
            >
              {entry.label}
            </text>
          ))}
          {cells.map((entry) => {
            const total = entry.itemCount + entry.eventCount;
            return (
              <rect
                key={entry.date}
                fill={
                  total === 0 ? "var(--color-surface-subtle)" : color(total)
                }
                height={cell}
                rx="2"
                width={cell}
                x={left + entry.week * (cell + gap)}
                y={top + entry.weekday * (cell + gap)}
              >
                <title>
                  {entry.date}: 合計{total}件（タイムライン{entry.itemCount}
                  件、イベント{entry.eventCount}件）
                </title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div
        className="flex items-center justify-end gap-1 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        <span>少ない</span>
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <span
            key={level}
            className="size-2.5"
            style={{
              backgroundColor:
                level === 0 ? "var(--color-surface-subtle)" : color(level),
            }}
          />
        ))}
        <span>多い</span>
      </div>
    </section>
  );
}

function csvRows(statistics: ProjectStatistics) {
  const sections: Array<[string, StatisticDatum[]]> = [
    ["種別", statistics.countsByType],
    ["タグ", statistics.countsByTag],
    ["世紀", statistics.countsByCentury],
    ["存続期間", statistics.durationDistribution],
    ["日付精度", statistics.datePrecision],
    ["終了状態", statistics.endStatus],
    ["関係種別", statistics.relationshipTypes],
    ["不足情報", statistics.completeness],
  ];
  return [
    ["区分", "項目", "件数"],
    ...sections.flatMap(([section, values]) =>
      values.map((entry) => [section, entry.label, String(entry.count)]),
    ),
  ];
}

export function StatisticsPanel({
  projectId,
  statistics,
  filtered,
}: {
  projectId: string;
  statistics: ProjectStatistics;
  filtered: boolean;
}) {
  const router = useRouter();
  const open = (entry: StatisticDatum) => {
    const first = entry.entities[0];
    if (first) router.push(entityPath(projectId, first));
  };
  const download = () => {
    const csv = csvRows(statistics)
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "project-statistics.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">統計</h2>
          <p className="text-sm text-muted-foreground">
            パネルを開いた時点のデータから計算します。
            {filtered ? "タイムラインのフィルター・期間強調を反映中です。" : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={download}>
          <Download aria-hidden="true" />
          CSV出力
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["タイムライン", statistics.totals.itemCount],
          ["イベント", statistics.totals.eventCount],
          ["関係", statistics.totals.relationshipCount],
          ["内部リンク", statistics.totals.internalLinkCount],
        ].map(([label, value]) => (
          <div key={label} className="border-l-2 border-primary pl-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <CreationHeatmap data={statistics.creationActivity} />
      <div className="grid gap-8 lg:grid-cols-2">
        <HorizontalBars
          data={statistics.countsByType}
          label="種別別"
          onOpen={open}
        />
        <HorizontalBars
          data={statistics.countsByTag}
          label="タグ別"
          onOpen={open}
        />
        <HorizontalBars
          data={statistics.countsByCentury}
          label="年代・世紀別"
          onOpen={open}
        />
        <HorizontalBars
          data={statistics.durationDistribution}
          label="存続期間分布"
          onOpen={open}
        />
        <DonutChart
          data={statistics.datePrecision}
          label="日付精度"
          onOpen={open}
        />
        <DonutChart
          data={statistics.endStatus}
          label="終了状態"
          onOpen={open}
        />
        <HorizontalBars
          data={statistics.relationshipTypes}
          label="関係種別"
          onOpen={open}
        />
        <HorizontalBars
          data={statistics.completeness}
          label="不足・構成"
          onOpen={open}
        />
      </div>
    </div>
  );
}
