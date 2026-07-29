import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import {
  chooseTickUnit,
  xToDate,
} from "@/features/timeline-items/timeline-math";
import type { HistoricalDate } from "@/features/timeline-items/types";

export type EventSnapPrecision = "year" | "month" | "day";

export function eventSnapPrecision(pixelsPerDay: number): EventSnapPrecision {
  const unit = chooseTickUnit(pixelsPerDay);
  if (unit === "century" || unit === "decade") return "year";
  if (unit === "year") return "month";
  return "day";
}

export function snapTimelineDate(
  x: number,
  originOrdinal: number,
  pixelsPerDay: number,
): HistoricalDate {
  const date = xToDate(x, originOrdinal, pixelsPerDay);
  const precision = eventSnapPrecision(pixelsPerDay);
  if (precision === "year")
    return { precision, year: date.year, month: null, day: null };
  if (precision === "month")
    return { precision, year: date.year, month: date.month, day: null };
  return { ...date, precision };
}

export function eventX(
  date: HistoricalDate,
  originOrdinal: number,
  pixelsPerDay: number,
) {
  return (historicalDateOrdinal(date) - originOrdinal) * pixelsPerDay;
}
