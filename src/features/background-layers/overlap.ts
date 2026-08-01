import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import type { TimelineBackgroundPeriod } from "@/features/background-layers/types";

export function overlappingBackgroundPeriodIds(
  periods: TimelineBackgroundPeriod[],
) {
  const overlapping = new Set<string>();
  const sorted = [...periods].sort(
    (left, right) =>
      historicalDateOrdinal(left.start, "start") -
        historicalDateOrdinal(right.start, "start") ||
      left.id.localeCompare(right.id),
  );
  let furthestEnd = Number.NEGATIVE_INFINITY;
  let furthestId: string | null = null;
  for (const period of sorted) {
    const start = historicalDateOrdinal(period.start, "start");
    const end = historicalDateOrdinal(period.end, "end");
    if (start <= furthestEnd && furthestId) {
      overlapping.add(period.id);
      overlapping.add(furthestId);
    }
    if (end > furthestEnd) {
      furthestEnd = end;
      furthestId = period.id;
    }
  }
  return overlapping;
}
