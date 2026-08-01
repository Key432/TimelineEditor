"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildOrthogonalRelationshipPath,
  relationshipEndpointKey,
  type RelationshipPoint,
} from "@/features/relationships/routing";
import type {
  EntityRelationship,
  RelationshipEntityOption,
  RelationshipEntityType,
} from "@/features/relationships/types";

export type RelationshipAnchor = RelationshipPoint & {
  entityType: RelationshipEntityType;
  entityId: string;
};

export type RelationshipDisplayMode = "standard" | "all" | "hidden";

export function RelationshipLayer({
  relationships,
  entities,
  anchors,
  displayMode,
  visibleStart,
  visibleEnd,
  left = 0,
  width,
  height,
}: {
  relationships: EntityRelationship[];
  entities: RelationshipEntityOption[];
  anchors: ReadonlyMap<string, RelationshipAnchor>;
  displayMode: RelationshipDisplayMode;
  visibleStart: number;
  visibleEnd: number;
  left?: number;
  width: number;
  height: number;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const labels = useMemo(
    () =>
      new Map(
        entities.map((entity) => [
          relationshipEndpointKey(entity.type, entity.id),
          entity.title,
        ]),
      ),
    [entities],
  );
  const visible = relationships.filter((relationship) => {
    const source = anchors.get(
      relationshipEndpointKey(relationship.sourceType, relationship.sourceId),
    );
    const target = anchors.get(
      relationshipEndpointKey(relationship.targetType, relationship.targetId),
    );
    if (!source || !target) return false;
    if (displayMode === "hidden") return false;
    return (
      (source.x >= visibleStart && source.x <= visibleEnd) ||
      (target.x >= visibleStart && target.x <= visibleEnd)
    );
  });
  const selected = relationships.find((item) => item.id === selectedId) ?? null;
  const label = (type: RelationshipEntityType, id: string) =>
    labels.get(relationshipEndpointKey(type, id)) ?? "削除済みの項目";

  return (
    <>
      <svg
        aria-label="関係線"
        className="pointer-events-none absolute top-0 z-50 overflow-hidden"
        data-visible-count={visible.length}
        data-testid="relationship-layer"
        height={height}
        style={{
          left,
          clipPath: `inset(0px ${Math.max(0, width - visibleEnd)}px 0px ${Math.max(0, visibleStart)}px)`,
        }}
        width={width}
      >
        <defs>
          <marker
            id="relationship-arrow"
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            orient="auto-start-reverse"
            refX="7"
            refY="4"
            viewBox="0 0 8 8"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
          </marker>
        </defs>
        {visible.map((relationship, index) => {
          const source = anchors.get(
            relationshipEndpointKey(
              relationship.sourceType,
              relationship.sourceId,
            ),
          )!;
          const target = anchors.get(
            relationshipEndpointKey(
              relationship.targetType,
              relationship.targetId,
            ),
          )!;
          const path = buildOrthogonalRelationshipPath(
            source,
            target,
            14 + (index % 6) * 6,
          ).d;
          const active =
            hoveredId === relationship.id || selectedId === relationship.id;
          const color = active
            ? "#FF3399"
            : displayMode === "all"
              ? "#007F7F"
              : "rgba(107, 114, 128, 0.42)";
          const markers = {
            markerStart:
              relationship.sourceMarker === "arrow"
                ? "url(#relationship-arrow)"
                : undefined,
            markerEnd:
              relationship.targetMarker === "arrow"
                ? "url(#relationship-arrow)"
                : undefined,
          };
          return (
            <g key={relationship.id}>
              <path
                data-testid={`relationship-stroke-${relationship.id}`}
                d={path}
                fill="none"
                stroke={color}
                strokeLinecap="square"
                strokeLinejoin="miter"
                strokeWidth={relationship.lineStyle === "double" ? 6 : 2.5}
                vectorEffect="non-scaling-stroke"
                {...markers}
              />
              {relationship.lineStyle === "double" ? (
                <path
                  d={path}
                  fill="none"
                  stroke="white"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <path
                aria-label={`${label(relationship.sourceType, relationship.sourceId)}と${label(relationship.targetType, relationship.targetId)}の関係 ${relationship.relationType}`}
                className="cursor-pointer focus-visible:outline-none"
                d={path}
                fill="none"
                pointerEvents="stroke"
                role="button"
                stroke="rgba(0, 176, 176, 0.001)"
                strokeWidth={14}
                tabIndex={0}
                onBlur={() => setHoveredId(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(relationship.id);
                }}
                onFocus={() => setHoveredId(relationship.id)}
                onMouseEnter={() => setHoveredId(relationship.id)}
                onMouseLeave={() => setHoveredId(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(relationship.id);
                  }
                }}
              >
                <title>
                  {label(relationship.sourceType, relationship.sourceId)} —{" "}
                  {relationship.relationType} —{" "}
                  {label(relationship.targetType, relationship.targetId)}
                </title>
              </path>
            </g>
          );
        })}
      </svg>
      {selected ? (
        <div className="pointer-events-auto absolute top-14 right-3 z-[80] max-w-sm rounded-lg border bg-card p-3 text-sm shadow-lg">
          <p className="font-medium">{selected.relationType}</p>
          <p>
            {label(selected.sourceType, selected.sourceId)} →{" "}
            {label(selected.targetType, selected.targetId)}
          </p>
          {selected.note ? (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {selected.note}
            </p>
          ) : null}
          <Button
            className="mt-2"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setSelectedId(null)}
          >
            閉じる
          </Button>
        </div>
      ) : null}
    </>
  );
}
