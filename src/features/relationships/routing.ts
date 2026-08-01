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
  if (source.y === target.y) {
    return {
      d: `M ${source.x} ${source.y} L ${target.x} ${target.y}`,
      points: [source, target],
    };
  }
  const direction = target.x >= source.x ? 1 : -1;
  const channelX =
    source.x === target.x
      ? source.x + channelOffset
      : source.x +
        direction * Math.min(channelOffset, Math.abs(target.x - source.x) / 2);
  const points = [
    source,
    { x: channelX, y: source.y },
    { x: channelX, y: target.y },
    target,
  ];
  return {
    d: points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" "),
    points,
  };
}
