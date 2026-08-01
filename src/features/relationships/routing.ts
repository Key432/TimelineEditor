import type { RelationshipEntityType } from "@/features/relationships/types";

export type RelationshipPoint = { x: number; y: number };

export function relationshipEndpointKey(
  type: RelationshipEntityType,
  id: string,
) {
  return `${type}:${id}`;
}

export function buildOrthogonalRelationshipPath(
  source: RelationshipPoint,
  target: RelationshipPoint,
  channelOffset = 16,
) {
  const verticalDistance = Math.abs(target.y - source.y);
  const direction = target.y > source.y ? 1 : -1;
  const channelY =
    source.y === target.y
      ? source.y - channelOffset
      : source.y + direction * Math.min(channelOffset, verticalDistance / 2);
  const points = [
    source,
    { x: source.x, y: channelY },
    { x: target.x, y: channelY },
    target,
  ];
  return {
    d: points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" "),
    points,
  };
}
