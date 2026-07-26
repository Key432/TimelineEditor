import {
  astronomicalYear,
  formatHistoricalDate,
  historicalDateFromOrdinal,
  historicalDateOrdinal,
  historicalYear,
} from "@/features/timeline-items/historical-date";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";

export const ZOOM_PIXELS_PER_DAY = [0, 0.03, 0.18, 1.4, 9, 36] as const;
export const ZOOM_LABELS = [
  "全体表示",
  "世紀",
  "十年",
  "年",
  "月",
  "日",
] as const;

export type TickUnit = "century" | "decade" | "year" | "month" | "day";

export type TimelineTick = {
  ordinal: number;
  label: string;
  major: boolean;
};

const DAYS_PER_YEAR = 365.2425;

export function timelineItemEndDate(
  item: TimelineItemSummary,
  currentDate: HistoricalDate,
) {
  if (item.temporalType === "point") return item.point ?? currentDate;
  if (item.endDateStatus === "specified") {
    return item.end ?? item.start ?? currentDate;
  }
  if (item.endDateStatus === "ongoing") return currentDate;
  return item.lastConfirmed ?? item.start ?? currentDate;
}

export function timelineItemVisualBounds(
  item: TimelineItemSummary,
  currentDate: HistoricalDate,
  defaultUncertaintyYears: number,
) {
  const startDate = item.temporalType === "point" ? item.point : item.start;
  const start = historicalDateOrdinal(startDate ?? currentDate);
  if (item.temporalType === "point") return { start, end: start };
  const end = historicalDateOrdinal(
    timelineItemEndDate(item, currentDate),
    "end",
  );
  const startYears = item.startUncertaintyYears ?? defaultUncertaintyYears;
  const endYears = item.endUncertaintyYears ?? defaultUncertaintyYears;
  return {
    start: item.isStartApproximate ? start - startYears * DAYS_PER_YEAR : start,
    end:
      item.endDateStatus === "unknown" || item.isEndApproximate
        ? end + endYears * DAYS_PER_YEAR
        : end,
  };
}

export function dateToX(
  date: HistoricalDate,
  originOrdinal: number,
  pixelsPerDay: number,
) {
  return (historicalDateOrdinal(date) - originOrdinal) * pixelsPerDay;
}

export function xToDate(
  x: number,
  originOrdinal: number,
  pixelsPerDay: number,
) {
  if (pixelsPerDay <= 0) throw new RangeError("Scale must be positive.");
  return historicalDateFromOrdinal(originOrdinal + x / pixelsPerDay);
}

export function fitPixelsPerDay(
  start: HistoricalDate,
  end: HistoricalDate,
  viewportWidth: number,
  padding = 24,
) {
  const span = Math.max(
    1,
    historicalDateOrdinal(end, "end") - historicalDateOrdinal(start),
  );
  return Math.max(0.0001, (Math.max(1, viewportWidth) - padding * 2) / span);
}

export function expandDegenerateFitRange(start: number, end: number) {
  if (end > start) return { start, end };
  const halfSpan = 183;
  const expandedStart = start - halfSpan;
  return {
    start: expandedStart,
    end: Math.max(start + halfSpan, expandedStart + halfSpan * 2),
  };
}

export function scaleForZoomLevel(level: number, fitScale: number) {
  const normalized = Math.max(
    0,
    Math.min(ZOOM_PIXELS_PER_DAY.length - 1, level),
  );
  return normalized === 0
    ? fitScale
    : Math.max(fitScale, ZOOM_PIXELS_PER_DAY[normalized]);
}

export function scrollLeftAfterZoom(
  scrollLeft: number,
  cursorX: number,
  oldScale: number,
  newScale: number,
  contentOffset = 0,
) {
  const anchorDay = (scrollLeft + cursorX - contentOffset) / oldScale;
  return Math.max(0, anchorDay * newScale + contentOffset - cursorX);
}

export function chooseTickUnit(pixelsPerDay: number): TickUnit {
  const pixelsPerYear = pixelsPerDay * DAYS_PER_YEAR;
  if (pixelsPerYear < 8) return "century";
  if (pixelsPerYear < 56) return "decade";
  if (pixelsPerDay < 2.5) return "year";
  if (pixelsPerDay < 24) return "month";
  return "day";
}

function firstYearForStep(year: number, step: number) {
  return Math.ceil(year / step) * step;
}

function dateAtAstronomicalYear(year: number, month = 1, day = 1) {
  return {
    ...historicalYear(year),
    precision: "day" as const,
    month,
    day,
  };
}

function yearLabel(year: number) {
  const value = historicalYear(year);
  return `${value.era === "bce" ? "紀元前" : ""}${value.year}年`;
}

function pushYearTicks(
  ticks: TimelineTick[],
  startYear: number,
  endYear: number,
  step: number,
  majorStep: number,
) {
  for (
    let year = firstYearForStep(startYear, step);
    year <= endYear;
    year += step
  ) {
    const major = year % majorStep === 0;
    ticks.push({
      ordinal: historicalDateOrdinal(dateAtAstronomicalYear(year)),
      label: major ? yearLabel(year) : "",
      major,
    });
  }
}

function spacingStep(pixelsPerUnit: number, candidates: readonly number[]) {
  return (
    candidates.find((candidate) => candidate * pixelsPerUnit >= 80) ??
    candidates.at(-1)!
  );
}

function clampTickUnit(
  unit: TickUnit,
  minimumTimeUnit: "year" | "month" | "day",
) {
  const ranks: Record<TickUnit, number> = {
    century: 0,
    decade: 1,
    year: 2,
    month: 3,
    day: 4,
  };
  const maximumRank =
    minimumTimeUnit === "year" ? 2 : minimumTimeUnit === "month" ? 3 : 4;
  return ranks[unit] > maximumRank ? minimumTimeUnit : unit;
}

export function generateTimelineTicks(
  visibleStartOrdinal: number,
  visibleEndOrdinal: number,
  pixelsPerDay: number,
  minimumTimeUnit: "year" | "month" | "day" = "day",
): { unit: TickUnit; ticks: TimelineTick[] } {
  const start = historicalDateFromOrdinal(visibleStartOrdinal);
  const end = historicalDateFromOrdinal(visibleEndOrdinal);
  const startYear = astronomicalYear(start.era ?? "ce", start.year);
  const endYear = astronomicalYear(end.era ?? "ce", end.year);
  const unit = clampTickUnit(chooseTickUnit(pixelsPerDay), minimumTimeUnit);
  const ticks: TimelineTick[] = [];

  if (unit === "century") {
    const yearPixels = pixelsPerDay * DAYS_PER_YEAR;
    const majorStep = spacingStep(yearPixels, [100, 200, 500, 1000]);
    const minorStep = spacingStep(yearPixels * 5, [20, 50, 100, 200]);
    pushYearTicks(ticks, startYear, endYear, minorStep, majorStep);
  } else if (unit === "decade") {
    const yearPixels = pixelsPerDay * DAYS_PER_YEAR;
    const majorStep = spacingStep(yearPixels, [2, 5, 10, 20, 50]);
    const minorStep = spacingStep(yearPixels * 5, [1, 2, 5, 10]);
    pushYearTicks(
      ticks,
      startYear,
      endYear,
      Math.min(majorStep, minorStep),
      majorStep,
    );
  } else if (unit === "year") {
    const labelEvery = spacingStep(pixelsPerDay * 30.436875, [1, 3, 6, 12]);
    let year = startYear;
    let month = start.month ?? 1;
    while (year < endYear || (year === endYear && month <= (end.month ?? 12))) {
      const major = month === 1;
      ticks.push({
        ordinal: historicalDateOrdinal(dateAtAstronomicalYear(year, month)),
        label: major
          ? yearLabel(year)
          : (month - 1) % labelEvery === 0
            ? `${month}月`
            : "",
        major,
      });
      month += 1;
      if (month === 13) {
        year += 1;
        month = 1;
      }
    }
  } else if (unit === "month") {
    let year = startYear;
    let month = start.month ?? 1;
    while (year < endYear || (year === endYear && month <= (end.month ?? 12))) {
      ticks.push({
        ordinal: historicalDateOrdinal(dateAtAstronomicalYear(year, month)),
        label: month === 1 ? yearLabel(year) : `${month}月`,
        major: month === 1,
      });
      month += 1;
      if (month === 13) {
        year += 1;
        month = 1;
      }
    }
  } else {
    let ordinal = historicalDateOrdinal(start);
    const last = historicalDateOrdinal(end, "end");
    while (ordinal <= last) {
      const date = historicalDateFromOrdinal(ordinal);
      const major = date.day === 1;
      ticks.push({
        ordinal,
        label: major
          ? formatHistoricalDate({ ...date, precision: "month", day: null })
          : date.day === 5 ||
              date.day === 10 ||
              date.day === 15 ||
              date.day === 20 ||
              date.day === 25
            ? String(date.day)
            : "",
        major,
      });
      ordinal += 1;
    }
  }

  return { unit, ticks };
}

export function uncertaintyWidth(
  uncertaintyYears: number,
  pixelsPerDay: number,
  maximumWidth: number,
) {
  return Math.min(
    maximumWidth,
    Math.max(0, uncertaintyYears) * DAYS_PER_YEAR * pixelsPerDay,
  );
}

export function overlapsViewport(
  startX: number,
  endX: number,
  viewportStart: number,
  viewportEnd: number,
  overscan = 80,
) {
  return endX >= viewportStart - overscan && startX <= viewportEnd + overscan;
}
