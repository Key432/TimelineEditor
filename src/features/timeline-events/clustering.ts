export const EVENT_COLLISION_DIAMETER_PX = 10;
export const EVENT_COLLISION_PADDING_PX = 0;

export type PositionedTimelineMarker<T> = {
  x: number;
  value: T;
};

export type TimelineMarkerGroup<T> = {
  x: number;
  markers: PositionedTimelineMarker<T>[];
};

export function clusterTimelineMarkers<T>(
  markers: PositionedTimelineMarker<T>[],
  collisionDiameterPx = EVENT_COLLISION_DIAMETER_PX,
  collisionPaddingPx = EVENT_COLLISION_PADDING_PX,
): TimelineMarkerGroup<T>[] {
  if (markers.length === 0) return [];

  const sorted = [...markers].sort((left, right) => left.x - right.x);
  const groups: TimelineMarkerGroup<T>[] = [];
  let current: PositionedTimelineMarker<T>[] = [sorted[0]!];
  let currentRight = sorted[0]!.x + collisionDiameterPx / 2;

  for (const marker of sorted.slice(1)) {
    const markerLeft = marker.x - collisionDiameterPx / 2;
    if (markerLeft <= currentRight + collisionPaddingPx) {
      current.push(marker);
      currentRight = Math.max(currentRight, marker.x + collisionDiameterPx / 2);
      continue;
    }

    groups.push({
      x: current.reduce((sum, entry) => sum + entry.x, 0) / current.length,
      markers: current,
    });
    current = [marker];
    currentRight = marker.x + collisionDiameterPx / 2;
  }

  groups.push({
    x: current.reduce((sum, entry) => sum + entry.x, 0) / current.length,
    markers: current,
  });
  return groups;
}
