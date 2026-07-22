export const EVENT_COLLISION_DIAMETER_PX = 10;
export const EVENT_COLLISION_PADDING_PX = 0;
export const EVENT_MARKER_RENDER_DIAMETER_PX = 12;
export const EVENT_CLUSTER_RENDER_DIAMETER_PX = 24;

export type PositionedTimelineMarker<T> = {
  x: number;
  value: T;
};

export type TimelineMarkerGroup<T> = {
  x: number;
  markers: PositionedTimelineMarker<T>[];
};

function groupFromMarkers<T>(
  markers: PositionedTimelineMarker<T>[],
): TimelineMarkerGroup<T> {
  return {
    x: markers.reduce((sum, entry) => sum + entry.x, 0) / markers.length,
    markers,
  };
}

function renderedDiameter<T>(group: TimelineMarkerGroup<T>) {
  return group.markers.length > 1
    ? EVENT_CLUSTER_RENDER_DIAMETER_PX
    : EVENT_MARKER_RENDER_DIAMETER_PX;
}

function renderedGroupsOverlap<T>(
  left: TimelineMarkerGroup<T>,
  right: TimelineMarkerGroup<T>,
) {
  if (left.markers.length === 1 && right.markers.length === 1) return false;
  const minimumDistance =
    renderedDiameter(left) / 2 + renderedDiameter(right) / 2;
  return right.x - left.x <= minimumDistance;
}

function mergeRenderedCollisions<T>(groups: TimelineMarkerGroup<T>[]) {
  const merged: TimelineMarkerGroup<T>[] = [];
  for (const group of groups) {
    merged.push(group);
    while (merged.length > 1) {
      const right = merged.at(-1)!;
      const left = merged.at(-2)!;
      if (!renderedGroupsOverlap(left, right)) break;
      merged.splice(
        -2,
        2,
        groupFromMarkers([...left.markers, ...right.markers]),
      );
    }
  }
  return merged;
}

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

    groups.push(groupFromMarkers(current));
    current = [marker];
    currentRight = marker.x + collisionDiameterPx / 2;
  }

  groups.push(groupFromMarkers(current));
  return mergeRenderedCollisions(groups);
}
