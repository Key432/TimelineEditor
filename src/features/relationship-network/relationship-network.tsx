"use client";

import {
  Focus,
  Maximize2,
  Network,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  layoutBounds,
  layoutNetwork,
  networkEdgePath,
} from "@/features/relationship-network/network-layout";
import {
  buildNetworkEdges,
  buildNetworkNodes,
  EMPTY_NETWORK_FILTERS,
  filterNetwork,
  networkFiltersFromTimeline,
  networkNeighborhood,
  stageNetwork,
  type NetworkFilters,
} from "@/features/relationship-network/network-model";
import type { RelationshipDataset } from "@/features/relationships/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type { TimelineFilters } from "@/features/timeline-items/timeline-filters";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import { cn } from "@/lib/utils";

const MIN_SCALE = 0.18;
const MAX_SCALE = 3;

type ViewTransform = { x: number; y: number; scale: number };

function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={selected.length > 0 ? "secondary" : "outline"}
        >
          {label}
          {selected.length > 0 ? (
            <Badge className="h-5 px-1.5" variant="outline">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 min-w-56 overflow-y-auto"
      >
        <DropdownMenuLabel>{label}で絞り込む</DropdownMenuLabel>
        {selected.length > 0 ? (
          <>
            <DropdownMenuCheckboxItem
              checked
              onCheckedChange={() => onChange([])}
            >
              選択を解除
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {options.length === 0 ? (
          <DropdownMenuCheckboxItem disabled>
            候補はありません
          </DropdownMenuCheckboxItem>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={selected.includes(option.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function yearInput(value: string) {
  if (!value.trim() || !/^-?\d+$/.test(value.trim())) return null;
  return Number(value);
}

function edgeOffset(index: number) {
  if (index === 0) return 0;
  const level = Math.ceil(index / 2) * 18;
  return index % 2 === 0 ? -level : level;
}

export function RelationshipNetwork({
  items,
  events,
  dataset,
  initialTimelineFilters,
  onOpenItem,
  onOpenEvent,
}: {
  items: TimelineItemSummary[];
  events: TimelineEventSummary[];
  dataset: RelationshipDataset;
  initialTimelineFilters: TimelineFilters;
  onOpenItem?: (id: string) => void;
  onOpenEvent?: (id: string, editing: boolean) => void;
}) {
  const viewportRef = useRef<SVGSVGElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 620 });
  const [filters, setFilters] = useState<NetworkFilters>(() =>
    networkFiltersFromTimeline(initialTimelineFilters),
  );
  const [fromYear, setFromYear] = useState(() =>
    initialTimelineFilters.fromYear === null
      ? ""
      : String(initialTimelineFilters.fromYear),
  );
  const [toYear, setToYear] = useState(() =>
    initialTimelineFilters.toYear === null
      ? ""
      : String(initialTimelineFilters.toYear),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expansionSteps, setExpansionSteps] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [transform, setTransform] = useState<ViewTransform | null>(null);
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const pointer = useRef<{
    mode: "pan" | "node";
    pointerId: number;
    nodeId?: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

  const allNodes = useMemo(
    () => buildNetworkNodes(items, events),
    [events, items],
  );
  const allEdges = useMemo(
    () => buildNetworkEdges(dataset.relationships),
    [dataset.relationships],
  );
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(
    () => filterNetwork(allNodes, allEdges, deferredFilters),
    [allEdges, allNodes, deferredFilters],
  );
  const staged = useMemo(
    () => stageNetwork(filtered.nodes, filtered.edges, expansionSteps),
    [expansionSteps, filtered.edges, filtered.nodes],
  );
  const layout = useMemo(
    () => layoutNetwork(staged.nodes, staged.edges),
    [staged.edges, staged.nodes],
  );
  const bounds = useMemo(() => layoutBounds(layout), [layout]);
  const positioned = useMemo(
    () =>
      layout.map((node) => ({
        ...node,
        ...(positionOverrides[node.id] ?? {}),
      })),
    [layout, positionOverrides],
  );
  const nodeMap = useMemo(
    () => new Map(positioned.map((node) => [node.id, node])),
    [positioned],
  );
  const effectiveSelectedId =
    selectedId && nodeMap.has(selectedId) ? selectedId : null;
  const neighborhood = useMemo(
    () => networkNeighborhood(effectiveSelectedId, staged.edges),
    [effectiveSelectedId, staged.edges],
  );
  const selected = effectiveSelectedId
    ? (nodeMap.get(effectiveSelectedId) ?? null)
    : null;
  const typeOptions = useMemo(
    () =>
      [
        ...new Map(
          allNodes.map((node) => [node.typeKey, node.typeLabel]),
        ).entries(),
      ]
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "ja")),
    [allNodes],
  );
  const tagOptions = useMemo(
    () =>
      [
        ...new Map(
          allNodes.flatMap((node) =>
            node.tagIds.map(
              (id, index) => [id, node.tagLabels[index] ?? id] as const,
            ),
          ),
        ).entries(),
      ]
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "ja")),
    [allNodes],
  );
  const relationOptions = useMemo(
    () =>
      [...new Set(allEdges.map((edge) => edge.relationType))]
        .sort((a, b) => a.localeCompare(b, "ja"))
        .map((value) => ({ id: value, label: value })),
    [allEdges],
  );

  const fitTransform = useMemo(() => {
    const scale = clampScale(
      Math.min(
        viewportSize.width / bounds.width,
        viewportSize.height / bounds.height,
      ) * 0.92,
    );
    return {
      x: viewportSize.width / 2 - (bounds.minX + bounds.width / 2) * scale,
      y: viewportSize.height / 2 - (bounds.minY + bounds.height / 2) * scale,
      scale,
    };
  }, [bounds, viewportSize.height, viewportSize.width]);
  const activeTransform = transform ?? fitTransform;
  const fit = useCallback(() => setTransform(fitTransform), [fitTransform]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0)
        setViewportSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function updateFilter<K extends keyof NetworkFilters>(
    key: K,
    value: NetworkFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setTransform(null);
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;
    setTransform((current) => {
      const base = current ?? fitTransform;
      const scale = clampScale(base.scale * factor);
      const worldX = (cursorX - base.x) / base.scale;
      const worldY = (cursorY - base.y) / base.scale;
      return {
        x: cursorX - worldX * scale,
        y: cursorY - worldY * scale,
        scale,
      };
    });
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const active = pointer.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) active.moved = true;
    active.x = event.clientX;
    active.y = event.clientY;
    if (active.mode === "pan") {
      setTransform((current) => ({
        ...(current ?? fitTransform),
        x: (current ?? fitTransform).x + dx,
        y: (current ?? fitTransform).y + dy,
      }));
    } else if (active.nodeId) {
      const node = nodeMap.get(active.nodeId);
      if (!node) return;
      const nodeId = active.nodeId;
      setPositionOverrides((current) => {
        const base = current[nodeId] ?? { x: node.x, y: node.y };
        return {
          ...current,
          [nodeId]: {
            x: base.x + dx / activeTransform.scale,
            y: base.y + dy / activeTransform.scale,
          },
        };
      });
    }
  }

  function finishPointer(event: React.PointerEvent<SVGSVGElement>) {
    const active = pointer.current;
    if (active?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (active.mode === "node" && active.nodeId && !active.moved)
      setSelectedId(active.nodeId);
    pointer.current = null;
  }

  const edgeOccurrences = new Map<string, number>();

  return (
    <section
      className="flex min-h-[32rem] min-w-0 flex-1 flex-col gap-3 rounded-xl border bg-card p-3"
      data-testid="relationship-network"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <span className="sr-only">ノードを検索</span>
          <Input
            className="pl-9"
            placeholder="ノード名、種別、タグを検索"
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
          />
        </label>
        <FilterMenu
          label="種別"
          options={typeOptions}
          selected={filters.typeKeys}
          onChange={(value) => updateFilter("typeKeys", value)}
        />
        <FilterMenu
          label="タグ"
          options={tagOptions}
          selected={filters.tagIds}
          onChange={(value) => updateFilter("tagIds", value)}
        />
        <FilterMenu
          label="関係種別"
          options={relationOptions}
          selected={filters.relationTypes}
          onChange={(value) => updateFilter("relationTypes", value)}
        />
        <label>
          <span className="sr-only">開始年、紀元前は負数</span>
          <Input
            className="w-32"
            inputMode="numeric"
            placeholder="開始年（BCは-）"
            value={fromYear}
            onChange={(event) => {
              setFromYear(event.target.value);
              updateFilter("fromYear", yearInput(event.target.value));
            }}
          />
        </label>
        <label>
          <span className="sr-only">終了年、紀元前は負数</span>
          <Input
            className="w-32"
            inputMode="numeric"
            placeholder="終了年（BCは-）"
            value={toYear}
            onChange={(event) => {
              setToYear(event.target.value);
              updateFilter("toYear", yearInput(event.target.value));
            }}
          />
        </label>
        <Button
          aria-label="ネットワークのフィルターを解除"
          size="icon-sm"
          title="フィルターを解除"
          variant="ghost"
          onClick={() => {
            setFilters(EMPTY_NETWORK_FILTERS);
            setFromYear("");
            setToYear("");
            setTransform(null);
          }}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>

      <div className="relative min-h-[28rem] flex-1 overflow-hidden rounded-lg border bg-[radial-gradient(circle,#d1d5db_1px,transparent_1px)] [background-size:20px_20px]">
        <svg
          ref={viewportRef}
          aria-label="意味的関係のネットワーク図"
          className="absolute inset-0 size-full touch-none select-none"
          data-testid="relationship-network-canvas"
          role="application"
          onPointerCancel={finishPointer}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointer.current = {
              mode: "pan",
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              moved: false,
            };
          }}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onWheel={(event) => {
            event.preventDefault();
            zoomAt(
              event.clientX,
              event.clientY,
              event.deltaY < 0 ? 1.14 : 1 / 1.14,
            );
          }}
        >
          <defs>
            <marker
              id="network-arrow"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              markerWidth="9"
              orient="auto-start-reverse"
              refX="8"
              refY="4.5"
              viewBox="0 0 9 9"
            >
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill="context-stroke" />
            </marker>
          </defs>
          <g
            transform={`translate(${activeTransform.x} ${activeTransform.y}) scale(${activeTransform.scale})`}
          >
            <g aria-label="関係エッジ">
              {staged.edges.map((edge) => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (!source || !target) return null;
                const pairKey = [edge.source, edge.target].sort().join("|");
                const occurrence = edgeOccurrences.get(pairKey) ?? 0;
                edgeOccurrences.set(pairKey, occurrence + 1);
                const path = networkEdgePath(
                  source,
                  target,
                  edgeOffset(occurrence),
                );
                const selectedEdge =
                  effectiveSelectedId === edge.source ||
                  effectiveSelectedId === edge.target;
                const faded = effectiveSelectedId !== null && !selectedEdge;
                const stroke = selectedEdge ? "#FF3399" : "#64748B";
                const markers = {
                  markerStart:
                    edge.sourceMarker === "arrow"
                      ? "url(#network-arrow)"
                      : undefined,
                  markerEnd:
                    edge.targetMarker === "arrow"
                      ? "url(#network-arrow)"
                      : undefined,
                };
                return (
                  <g
                    key={edge.id}
                    className={cn(faded && "opacity-15")}
                    data-testid={`network-edge-${edge.id}`}
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={edge.lineStyle === "double" ? 7 : 2.5}
                      vectorEffect="non-scaling-stroke"
                      {...markers}
                    >
                      <title>{edge.relationType}</title>
                    </path>
                    {edge.lineStyle === "double" ? (
                      <path
                        d={path}
                        fill="none"
                        stroke="white"
                        strokeWidth="2.4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                  </g>
                );
              })}
            </g>
            <g aria-label="ノード">
              {positioned.map((node) => {
                const isSelected = effectiveSelectedId === node.id;
                const isDirect = neighborhood.direct.has(node.id);
                const isSecond = neighborhood.second.has(node.id);
                const isFaded =
                  effectiveSelectedId !== null &&
                  !isSelected &&
                  !isDirect &&
                  !isSecond;
                const subtitle =
                  node.kind === "cluster"
                    ? `${node.count}件を段階展開`
                    : node.entityType === "timeline_item"
                      ? `タイムライン · ${node.typeLabel}`
                      : `イベント · ${node.typeLabel}`;
                return (
                  <g
                    key={node.id}
                    aria-label={`${node.title}、${subtitle}`}
                    className={cn(
                      "cursor-grab focus-visible:outline-none",
                      isFaded && "opacity-20",
                    )}
                    data-node-id={node.id}
                    data-testid={`network-node-${node.id}`}
                    role="button"
                    tabIndex={0}
                    transform={`translate(${node.x - node.width / 2} ${node.y - node.height / 2})`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (node.kind === "cluster") {
                        setExpansionSteps((current) => {
                          const next = new Map(current);
                          next.set(
                            node.typeKey,
                            (next.get(node.typeKey) ?? 0) + 1,
                          );
                          return next;
                        });
                        setTransform(null);
                      } else setSelectedId(node.id);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      if (node.kind !== "entity") return;
                      if (node.entityType === "timeline_item")
                        onOpenItem?.(node.entityId);
                      else onOpenEvent?.(node.entityId, false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      if (node.kind === "cluster") {
                        setExpansionSteps((current) => {
                          const next = new Map(current);
                          next.set(
                            node.typeKey,
                            (next.get(node.typeKey) ?? 0) + 1,
                          );
                          return next;
                        });
                        setTransform(null);
                      } else setSelectedId(node.id);
                    }}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || node.kind === "cluster") return;
                      event.stopPropagation();
                      viewportRef.current?.setPointerCapture(event.pointerId);
                      pointer.current = {
                        mode: "node",
                        pointerId: event.pointerId,
                        nodeId: node.id,
                        x: event.clientX,
                        y: event.clientY,
                        moved: false,
                      };
                    }}
                  >
                    <rect
                      fill="white"
                      height={node.height}
                      rx="12"
                      stroke={
                        isSelected
                          ? "#FF3399"
                          : isDirect
                            ? "#00B0B0"
                            : isSecond
                              ? "#5B8DEF"
                              : "#CBD5E1"
                      }
                      strokeWidth={isSelected || isDirect ? 3 : 2}
                      width={node.width}
                    />
                    <rect
                      fill={node.color}
                      height={node.height - 4}
                      rx="4"
                      width="6"
                      x="4"
                      y="2"
                    />
                    <text
                      fill="#333333"
                      fontSize="14"
                      fontWeight="600"
                      x="18"
                      y="25"
                    >
                      {node.title.length > 20
                        ? `${node.title.slice(0, 19)}…`
                        : node.title}
                    </text>
                    <text fill="#64748B" fontSize="10.5" x="18" y="43">
                      {subtitle.length > 27
                        ? `${subtitle.slice(0, 26)}…`
                        : subtitle}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-sm">
          <Network aria-hidden="true" className="size-4 text-primary" />
          <span>
            {positioned.filter((node) => node.kind === "entity").length}ノード・
            {staged.edges.length}エッジ
          </span>
          {staged.hiddenCount > 0 ? (
            <Badge variant="secondary">
              残り{staged.hiddenCount}件はクラスタ
            </Badge>
          ) : null}
        </div>
        <div className="absolute right-3 bottom-3 flex gap-1 rounded-lg border bg-card/95 p-1 shadow-sm">
          <Button
            aria-label="縮小"
            size="icon-sm"
            variant="ghost"
            onClick={() =>
              setTransform((current) => ({
                ...(current ?? fitTransform),
                scale: clampScale((current ?? fitTransform).scale / 1.2),
              }))
            }
          >
            <ZoomOut aria-hidden="true" />
          </Button>
          <Button
            aria-label="全体に合わせる"
            size="icon-sm"
            variant="ghost"
            onClick={fit}
          >
            <Maximize2 aria-hidden="true" />
          </Button>
          <Button
            aria-label="拡大"
            size="icon-sm"
            variant="ghost"
            onClick={() =>
              setTransform((current) => ({
                ...(current ?? fitTransform),
                scale: clampScale((current ?? fitTransform).scale * 1.2),
              }))
            }
          >
            <ZoomIn aria-hidden="true" />
          </Button>
        </div>
        <p className="absolute bottom-3 left-3 rounded-md bg-card/90 px-2 py-1 text-xs text-muted-foreground">
          ホイールで拡大縮小・余白ドラッグで移動・ノードをドラッグして一時配置
        </p>

        {selected?.kind === "entity" ? (
          <aside
            className="absolute top-3 right-3 w-72 rounded-xl border bg-card/95 p-4 shadow-lg"
            aria-label="選択ノードの情報"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{selected.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.typeLabel}
                </p>
              </div>
              <Button
                aria-label="選択を解除"
                size="icon-sm"
                variant="ghost"
                onClick={() => setSelectedId(null)}
              >
                <Focus aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <Badge variant="outline">直接 {neighborhood.direct.size}</Badge>
              <Badge variant="outline">2段階 {neighborhood.second.size}</Badge>
            </div>
            <Button
              className="mt-4 w-full"
              size="sm"
              onClick={() => {
                if (selected.entityType === "timeline_item")
                  onOpenItem?.(selected.entityId);
                else onOpenEvent?.(selected.entityId, false);
              }}
            >
              詳細を開く
            </Button>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
