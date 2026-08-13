import {
  layoutBounds,
  layoutNetwork,
  networkEdgePath,
  truncateNetworkSubtitle,
  wrapNetworkTitle,
} from "@/features/relationship-network/network-layout";
import {
  buildNetworkEdges,
  buildNetworkNodes,
  stageNetwork,
} from "@/features/relationship-network/network-model";
import { calculateCompactLaneLayout } from "@/features/timeline-items/compact-lane-layout";
import {
  astronomicalYear,
  historicalDateFromOrdinal,
  historicalDateOrdinal,
  historicalYear,
} from "@/features/timeline-items/historical-date";
import { timelineItemVisualBounds } from "@/features/timeline-items/timeline-math";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import type {
  VisualExportOptions,
  VisualExportSnapshot,
} from "@/features/visual-export/types";

const FONT_STACK = "'Noto Sans JP','Yu Gothic',Meiryo,sans-serif";
const PRIMARY = "#00B0B0";
const TEXT = "#333333";
const BORDER = "#D8E1E1";

export type BuiltVisualSvg = {
  svg: string;
  width: number;
  height: number;
  fileStem: string;
};

function xml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeFileStem(value: string) {
  return (
    value
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "timeline"
  );
}

function itemRegisteredBounds(item: TimelineItemSummary) {
  if (item.temporalType === "point") {
    const ordinal = item.point ? historicalDateOrdinal(item.point) : 0;
    return { start: ordinal, end: ordinal };
  }
  const start = item.start ? historicalDateOrdinal(item.start) : 0;
  const endDate =
    item.endDateStatus === "specified"
      ? item.end
      : (item.lastConfirmed ?? item.start);
  return {
    start,
    end: endDate ? historicalDateOrdinal(endDate, "end") : start,
  };
}

function fullRange(snapshot: VisualExportSnapshot) {
  const values: number[] = [];
  for (const item of snapshot.items) {
    const bounds = itemRegisteredBounds(item);
    values.push(bounds.start, bounds.end);
  }
  for (const event of snapshot.events)
    values.push(historicalDateOrdinal(event.date));
  for (const layer of snapshot.backgroundLayers) {
    for (const period of layer.periods) {
      values.push(
        historicalDateOrdinal(period.start),
        historicalDateOrdinal(period.end, "end"),
      );
    }
  }
  if (values.length === 0) {
    return {
      startOrdinal: historicalDateOrdinal({
        year: snapshot.project.settings.initialStartYear,
        month: 1,
        day: 1,
      }),
      endOrdinal: historicalDateOrdinal(
        {
          year: snapshot.project.settings.initialEndYear,
          month: 12,
          day: 31,
        },
        "end",
      ),
    };
  }
  return {
    startOrdinal: Math.min(...values),
    endOrdinal: Math.max(...values),
  };
}

function dateForSignedInputYear(year: number) {
  return year < 0
    ? ({ era: "bce", year: Math.abs(year) } as const)
    : ({ era: "ce", year } as const);
}

export function resolveVisualExportRange(
  snapshot: VisualExportSnapshot,
  options: VisualExportOptions,
) {
  if (options.rangeMode === "viewport" && snapshot.viewport)
    return snapshot.viewport;
  if (options.rangeMode === "highlight" && snapshot.highlightRange)
    return snapshot.highlightRange;
  if (options.rangeMode === "custom") {
    const start = dateForSignedInputYear(options.customStartYear);
    const end = dateForSignedInputYear(options.customEndYear);
    return {
      startOrdinal: historicalDateOrdinal({ ...start, month: 1, day: 1 }),
      endOrdinal: historicalDateOrdinal({ ...end, month: 12, day: 31 }, "end"),
    };
  }
  return fullRange(snapshot);
}

function header(
  snapshot: VisualExportSnapshot,
  options: VisualExportOptions,
  width: number,
) {
  let y = 28;
  const parts: string[] = [];
  if (options.includeTitle) {
    parts.push(
      `<text x="24" y="${y}" font-size="20" font-weight="700" fill="${TEXT}">${xml(snapshot.project.name)}</text>`,
    );
    y += 30;
  }
  if (options.includeDescription && snapshot.project.description) {
    const description = snapshot.project.description.replace(/\s+/g, " ");
    const chars = Math.max(24, Math.floor((width - 48) / 14));
    const lines = [
      description.slice(0, chars),
      description.slice(chars, chars * 2),
    ]
      .filter(Boolean)
      .map((line) => (line.length === chars ? `${line}…` : line));
    parts.push(
      `<text x="24" y="${y}" font-size="12" fill="#666666">${lines
        .map(
          (line, index) =>
            `<tspan x="24" dy="${index === 0 ? 0 : 18}">${xml(line)}</tspan>`,
        )
        .join("")}</text>`,
    );
    y += lines.length * 18 + 8;
  }
  if (options.includeLegend) {
    const types = new Map(
      snapshot.items.map((item) => [
        item.typeId,
        { name: item.itemType.name, color: item.itemType.defaultColor },
      ]),
    );
    let x = 24;
    for (const type of types.values()) {
      const labelWidth = Math.min(180, 28 + Array.from(type.name).length * 13);
      if (x + labelWidth > width - 24) {
        x = 24;
        y += 24;
      }
      parts.push(
        `<rect x="${x}" y="${y - 11}" width="12" height="12" rx="2" fill="${xml(type.color)}"/><text x="${x + 18}" y="${y}" font-size="11" fill="${TEXT}">${xml(type.name)}</text>`,
      );
      x += labelWidth;
    }
    y += 18;
  }
  return { svg: parts.join(""), height: Math.max(12, y) };
}

function yearLabel(astronomical: number) {
  const value = historicalYear(astronomical);
  return value.era === "bce" ? `紀元前${value.year}年` : `${value.year}年`;
}

function axisTicks(
  startOrdinal: number,
  endOrdinal: number,
  x: (n: number) => number,
) {
  const startDate = historicalDateFromOrdinal(startOrdinal);
  const endDate = historicalDateFromOrdinal(endOrdinal);
  const startYear = astronomicalYear(startDate.era ?? "ce", startDate.year);
  const endYear = astronomicalYear(endDate.era ?? "ce", endDate.year);
  const span = Math.max(1, endYear - startYear);
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  const step = steps.find((candidate) => span / candidate <= 12) ?? 5000;
  const first = Math.ceil(startYear / step) * step;
  const ticks: { x: number; label: string }[] = [];
  for (let year = first; year <= endYear; year += step) {
    const value = historicalYear(year);
    ticks.push({
      x: x(historicalDateOrdinal({ ...value, month: 1, day: 1 })),
      label: yearLabel(year),
    });
  }
  return ticks;
}

function timelineSvg(
  snapshot: VisualExportSnapshot,
  options: VisualExportOptions,
): BuiltVisualSvg {
  const range = resolveVisualExportRange(snapshot, options);
  const spanDays = Math.max(1, range.endOrdinal - range.startOrdinal);
  const plotWidth = Math.round(
    Math.min(12000, Math.max(960, (spanDays / 365.25) * 14)),
  );
  const labelWidth = options.layout === "row" ? 280 : 0;
  const width = plotWidth + labelWidth + 48;
  const heading = header(snapshot, options, width);
  const axisTop = heading.height;
  const contentTop = axisTop + 48;
  const x = (ordinal: number) =>
    labelWidth + 24 + ((ordinal - range.startOrdinal) / spanDays) * plotWidth;
  const pixelsPerDay = plotWidth / spanDays;
  const visibleGroups = snapshot.groups;
  const itemY = new Map<string, number>();
  const eventAnchors = new Map<string, { x: number; y: number }>();
  const parts: string[] = [heading.svg];
  let y = contentTop;

  const drawGroupHeader = (label: string, color: string, count: number) => {
    parts.push(
      `<rect x="0" y="${y}" width="${width}" height="34" fill="#F1F6F6" stroke="${BORDER}"/><rect x="14" y="${y + 10}" width="12" height="12" rx="2" fill="${xml(color || "#6B7280")}"/><text x="34" y="${y + 22}" font-size="12" font-weight="700" fill="${TEXT}">${xml(label)} (${count}件)</text>`,
    );
    y += 34;
  };

  for (const group of visibleGroups) {
    if (group.showHeader)
      drawGroupHeader(group.label, group.color, group.items.length);
    if (group.collapsed) continue;
    if (options.layout === "row") {
      for (const item of group.items) {
        itemY.set(item.id, y + 25);
        parts.push(
          `<rect x="0" y="${y}" width="${width}" height="50" fill="#FFFFFF" stroke="${BORDER}"/><text x="16" y="${y + 21}" font-size="12" font-weight="600" fill="${TEXT}">${xml(item.title.slice(0, 30))}</text><text x="16" y="${y + 38}" font-size="10" fill="#666666">${xml(item.itemType.name)}</text>`,
        );
        y += 50;
      }
    } else {
      const layout = calculateCompactLaneLayout({
        items: group.items,
        events: snapshot.events,
        currentDate: snapshot.currentDate,
        defaultUncertaintyYears:
          snapshot.project.settings.defaultUncertaintyYears,
        domainStart: range.startOrdinal,
        pixelsPerDay,
        titleWidth: (item) => Math.min(220, 12 + item.title.length * 13),
      });
      const startY = y;
      for (let laneIndex = 0; laneIndex < layout.lanes.length; laneIndex += 1) {
        parts.push(
          `<rect x="0" y="${y}" width="${width}" height="52" fill="#FFFFFF" stroke="${BORDER}"/>`,
        );
        y += 52;
      }
      for (const placement of layout.placements) {
        itemY.set(placement.itemId, startY + placement.laneIndex * 52 + 27);
      }
    }
  }
  const contentBottom = Math.max(y, contentTop + 60);

  for (const layer of snapshot.backgroundLayers) {
    for (const period of layer.periods) {
      const left = Math.max(
        labelWidth + 24,
        x(historicalDateOrdinal(period.start)),
      );
      const right = Math.min(
        labelWidth + 24 + plotWidth,
        x(historicalDateOrdinal(period.end, "end")),
      );
      if (right <= left) continue;
      parts.push(
        `<rect x="${left}" y="${contentTop}" width="${right - left}" height="${contentBottom - contentTop}" fill="${xml(period.color)}" fill-opacity="0.12"/><text x="${left + 5}" y="${contentTop + 15}" font-size="9" fill="${TEXT}">${xml(`${layer.name} · ${period.title}`)}</text>`,
      );
    }
  }

  const ticks = axisTicks(range.startOrdinal, range.endOrdinal, x);
  for (const tick of ticks) {
    const atRightEdge = tick.x > labelWidth + plotWidth - 70;
    parts.push(
      `<line x1="${tick.x}" y1="${axisTop}" x2="${tick.x}" y2="${contentBottom}" stroke="#CCD9D9"/><text x="${tick.x + (atRightEdge ? -4 : 4)}" y="${axisTop + 18}" font-size="10" fill="#666666" text-anchor="${atRightEdge ? "end" : "start"}">${xml(tick.label)}</text>`,
    );
  }
  parts.push(
    `<rect x="${labelWidth + 24}" y="${axisTop}" width="${plotWidth}" height="48" fill="#F1F6F6" fill-opacity="0.9" stroke="${BORDER}"/>`,
  );

  const itemMap = new Map(snapshot.items.map((item) => [item.id, item]));
  const dimmed = new Set(snapshot.dimmedItemIds);
  for (const [itemId, centerY] of itemY) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    const visual = timelineItemVisualBounds(
      item,
      snapshot.currentDate,
      snapshot.project.settings.defaultUncertaintyYears,
    );
    const left = Math.max(x(range.startOrdinal), x(visual.start));
    const right = Math.min(x(range.endOrdinal), x(visual.end));
    const color = item.colorOverride ?? item.itemType.defaultColor;
    if (item.temporalType === "point") {
      const bounds = itemRegisteredBounds(item);
      if (
        bounds.start >= range.startOrdinal &&
        bounds.start <= range.endOrdinal
      ) {
        parts.push(
          `<g opacity="${dimmed.has(item.id) ? 0.28 : 1}"><circle cx="${x(bounds.start)}" cy="${centerY}" r="7" fill="${xml(color)}" stroke="#FFFFFF" stroke-width="2"/>${options.layout === "compact" ? `<text x="${x(bounds.start) + 10}" y="${centerY + 4}" font-size="10" fill="${TEXT}">${xml(item.title.slice(0, 24))}</text>` : ""}</g>`,
        );
      }
    } else if (right >= left) {
      parts.push(
        `<g opacity="${dimmed.has(item.id) ? 0.28 : 1}"><rect x="${left}" y="${centerY - 7}" width="${Math.max(2, right - left)}" height="14" rx="7" fill="${xml(color)}"/><text x="${Math.min(right + 6, labelWidth + plotWidth - 120)}" y="${centerY + 4}" font-size="10" fill="${TEXT}">${options.layout === "compact" ? xml(item.title.slice(0, 24)) : ""}</text></g>`,
      );
    }
  }

  for (const event of snapshot.events) {
    const ordinal = historicalDateOrdinal(event.date);
    if (ordinal < range.startOrdinal || ordinal > range.endOrdinal) continue;
    const parentId = event.timelineItemIds.find((id) => itemY.has(id));
    if (!parentId) continue;
    const anchor = { x: x(ordinal), y: itemY.get(parentId)! };
    eventAnchors.set(event.id, anchor);
    parts.push(
      `<circle cx="${anchor.x}" cy="${anchor.y}" r="5" fill="${xml(event.eventType?.color ?? "#6B7280")}" stroke="#FFFFFF" stroke-width="2" opacity="${dimmed.has(parentId) ? 0.28 : 1}"><title>${xml(event.title)}</title></circle>`,
    );
  }

  for (const relationship of snapshot.relationships.relationships) {
    const source =
      relationship.sourceType === "timeline_item"
        ? itemY.has(relationship.sourceId)
          ? {
              x: x(
                (itemRegisteredBounds(itemMap.get(relationship.sourceId)!)
                  .start +
                  itemRegisteredBounds(itemMap.get(relationship.sourceId)!)
                    .end) /
                  2,
              ),
              y: itemY.get(relationship.sourceId)!,
            }
          : null
        : (eventAnchors.get(relationship.sourceId) ?? null);
    const target =
      relationship.targetType === "timeline_item"
        ? itemY.has(relationship.targetId)
          ? {
              x: x(
                (itemRegisteredBounds(itemMap.get(relationship.targetId)!)
                  .start +
                  itemRegisteredBounds(itemMap.get(relationship.targetId)!)
                    .end) /
                  2,
              ),
              y: itemY.get(relationship.targetId)!,
            }
          : null
        : (eventAnchors.get(relationship.targetId) ?? null);
    if (!source || !target) continue;
    const stroke = relationship.lineStyle === "double" ? 5 : 2;
    parts.push(
      `<path d="M ${source.x} ${source.y} L ${source.x} ${(source.y + target.y) / 2} L ${target.x} ${(source.y + target.y) / 2} L ${target.x} ${target.y}" fill="none" stroke="#64748B" stroke-opacity="0.72" stroke-width="${stroke}" marker-start="${relationship.sourceMarker === "arrow" ? "url(#export-arrow)" : ""}" marker-end="${relationship.targetMarker === "arrow" ? "url(#export-arrow)" : ""}"><title>${xml(relationship.relationType)}</title></path>${
        relationship.lineStyle === "double"
          ? `<path d="M ${source.x} ${source.y} L ${source.x} ${(source.y + target.y) / 2} L ${target.x} ${(source.y + target.y) / 2} L ${target.x} ${target.y}" fill="none" stroke="#FFFFFF" stroke-width="2"/>`
          : ""
      }`,
    );
  }

  if (options.rangeMode === "highlight" && snapshot.highlightRange) {
    const left = x(snapshot.highlightRange.startOrdinal);
    const right = x(snapshot.highlightRange.endOrdinal);
    parts.push(
      `<rect x="${left}" y="${contentTop}" width="${Math.max(1, right - left)}" height="${contentBottom - contentTop}" fill="${PRIMARY}" fill-opacity="0.08" stroke="${PRIMARY}" stroke-width="2"/>`,
    );
  }

  const height = contentBottom + 24;
  return {
    width,
    height,
    fileStem: safeFileStem(snapshot.project.name),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(snapshot.project.name)}"><defs><marker id="export-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#64748B"/></marker></defs><rect width="100%" height="100%" fill="#FFFFFF"/><g font-family="${FONT_STACK}">${parts.join("")}</g></svg>`,
  };
}

function networkSvg(
  snapshot: VisualExportSnapshot,
  options: VisualExportOptions,
): BuiltVisualSvg {
  const nodes = buildNetworkNodes(
    snapshot.networkItems,
    snapshot.networkEvents,
  );
  const edges = buildNetworkEdges(snapshot.relationships.relationships);
  const staged = stageNetwork(nodes, edges, new Map(), Number.MAX_SAFE_INTEGER);
  const positioned = layoutNetwork(staged.nodes, staged.edges);
  const bounds = layoutBounds(positioned, 60);
  const width = Math.max(720, Math.ceil(bounds.width));
  const heading = header(snapshot, options, width);
  const graphTop = heading.height;
  const height = Math.max(480, Math.ceil(bounds.height + graphTop));
  const nodeMap = new Map(positioned.map((node) => [node.id, node]));
  const parts: string[] = [heading.svg];
  const offsetX = -bounds.minX;
  const offsetY = graphTop - bounds.minY;
  for (const edge of staged.edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const path = networkEdgePath(source, target);
    parts.push(
      `<path d="${path}" fill="none" stroke="#64748B" stroke-width="${edge.lineStyle === "double" ? 6 : 2.5}" marker-start="${edge.sourceMarker === "arrow" ? "url(#export-network-arrow)" : ""}" marker-end="${edge.targetMarker === "arrow" ? "url(#export-network-arrow)" : ""}"/>${edge.lineStyle === "double" ? `<path d="${path}" fill="none" stroke="#FFFFFF" stroke-width="2"/>` : ""}`,
    );
  }
  for (const node of positioned) {
    const titleLines = wrapNetworkTitle(node.title, node.width);
    const subtitle = truncateNetworkSubtitle(
      node.kind === "cluster" ? `${node.count}件` : node.typeLabel,
      node.width,
    );
    const x = node.x - node.width / 2;
    const y = node.y - node.height / 2;
    const rx =
      node.kind === "entity" && node.entityType === "timeline_item" ? 0 : 12;
    parts.push(
      `<g transform="translate(${x} ${y})"><rect width="${node.width}" height="${node.height}" rx="${rx}" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/><rect x="4" y="2" width="6" height="${node.height - 4}" rx="3" fill="${xml(node.color)}"/><text x="18" y="${titleLines.length === 1 ? 32 : 23}" font-size="14" font-weight="600" fill="${TEXT}">${titleLines.map((line, index) => `<tspan x="18" dy="${index === 0 ? 0 : 18}">${xml(line)}</tspan>`).join("")}</text><text x="18" y="${node.height - 11}" font-size="10.5" fill="#64748B">${xml(subtitle)}</text></g>`,
    );
  }
  return {
    width,
    height,
    fileStem: safeFileStem(snapshot.project.name),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(snapshot.project.name)} 関連ネットワーク"><defs><marker id="export-network-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse"><path d="M0,0 L9,4.5 L0,9 z" fill="#64748B"/></marker></defs><rect width="100%" height="100%" fill="#FFFFFF"/><g font-family="${FONT_STACK}">${parts[0]}<g transform="translate(${offsetX} ${offsetY})">${parts.slice(1).join("")}</g></g></svg>`,
  };
}

export function buildVisualExportSvg(
  snapshot: VisualExportSnapshot,
  options: VisualExportOptions,
) {
  return options.layout === "network"
    ? networkSvg(snapshot, options)
    : timelineSvg(snapshot, options);
}
