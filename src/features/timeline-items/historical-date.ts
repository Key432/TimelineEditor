import type {
  HistoricalDate,
  HistoricalDatePrecision,
  HistoricalEra,
} from "@/features/timeline-items/types";

export const DEFAULT_CALENDAR = "proleptic_gregorian";

export function astronomicalYear(era: HistoricalEra, year: number) {
  return era === "ce" ? year : 1 - year;
}

export function historicalYear(astronomical: number) {
  return astronomical >= 1
    ? { era: "ce" as const, year: astronomical }
    : { era: "bce" as const, year: 1 - astronomical };
}

function floorDiv(value: number, divisor: number) {
  return Math.floor(value / divisor);
}

export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidHistoricalDate(date: HistoricalDate) {
  if (!Number.isInteger(date.year) || date.year < 1) return false;
  if (date.calendar !== undefined && !date.calendar.trim()) return false;
  const precision = historicalDatePrecision(date);
  if (precision === "century") {
    return date.month === null && date.day === null;
  }
  if (precision === "decade") {
    return date.year % 10 === 0 && date.month === null && date.day === null;
  }
  if (precision === "year") {
    return date.month === null && date.day === null;
  }
  if (precision === "month" && date.day !== null) return false;
  if (precision === "day" && date.day === null) return false;
  if (date.month === null) return false;
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12) {
    return false;
  }
  if (date.day === null) return true;
  return (
    Number.isInteger(date.day) &&
    date.day >= 1 &&
    date.day <=
      daysInMonth(astronomicalYear(date.era ?? "ce", date.year), date.month)
  );
}

export function historicalDateOrdinal(
  date: HistoricalDate,
  boundary: "start" | "end" = "start",
) {
  const range = historicalDateRange(date);
  const selected = boundary === "start" ? range.start : range.end;
  const month = selected.month;
  const day = selected.day;
  const year = selected.astronomicalYear;
  const previousYear = year - 1;
  const daysBeforeYear =
    previousYear * 365 +
    floorDiv(previousYear, 4) -
    floorDiv(previousYear, 100) +
    floorDiv(previousYear, 400);
  let daysBeforeMonth = 0;
  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    daysBeforeMonth += daysInMonth(year, currentMonth);
  }
  return daysBeforeYear + daysBeforeMonth + day - 1;
}

export function historicalDateRange(date: HistoricalDate) {
  const era = date.era ?? "ce";
  const precision = historicalDatePrecision(date);
  const inputYear = astronomicalYear(era, date.year);
  let startYear = inputYear;
  let endYear = inputYear;
  if (precision === "decade") {
    if (era === "ce") endYear += 9;
    else startYear = astronomicalYear("bce", date.year + 9);
  }
  if (precision === "century") {
    if (era === "ce") {
      startYear = (date.year - 1) * 100 + 1;
      endYear = date.year * 100;
    } else {
      startYear = astronomicalYear("bce", date.year * 100);
      endYear = astronomicalYear("bce", (date.year - 1) * 100 + 1);
    }
  }
  const startMonth =
    precision === "day" || precision === "month" ? (date.month ?? 1) : 1;
  const endMonth =
    precision === "day" || precision === "month" ? (date.month ?? 12) : 12;
  return {
    start: {
      astronomicalYear: startYear,
      month: startMonth,
      day: precision === "day" ? (date.day ?? 1) : 1,
    },
    end: {
      astronomicalYear: endYear,
      month: endMonth,
      day:
        precision === "day" ? (date.day ?? 1) : daysInMonth(endYear, endMonth),
    },
  };
}

export function historicalDateFromOrdinal(ordinal: number): HistoricalDate {
  if (!Number.isFinite(ordinal)) {
    throw new RangeError("Historical date ordinal must be finite.");
  }

  const wholeDay = Math.floor(ordinal);
  let low = floorDiv(wholeDay, 366) - 2;
  let high = floorDiv(wholeDay, 365) + 3;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    const display = historicalYear(middle);
    if (
      historicalDateOrdinal({
        ...display,
        precision: "day",
        month: 1,
        day: 1,
        originalText: null,
        calendar: DEFAULT_CALENDAR,
      }) <= wholeDay
    ) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  const astronomical = low;
  const display = historicalYear(astronomical);
  let dayOfYear =
    wholeDay -
    historicalDateOrdinal({
      ...display,
      precision: "day",
      month: 1,
      day: 1,
      originalText: null,
      calendar: DEFAULT_CALENDAR,
    });
  let month = 1;
  while (dayOfYear >= daysInMonth(astronomical, month)) {
    dayOfYear -= daysInMonth(astronomical, month);
    month += 1;
  }
  return display.era === "ce"
    ? { year: display.year, month, day: dayOfYear + 1 }
    : { era: "bce", year: display.year, month, day: dayOfYear + 1 };
}

export function formatHistoricalDate(date: HistoricalDate | null) {
  if (!date) return "—";
  if (date.originalText) return date.originalText;
  const era = date.era === "bce" ? "紀元前" : "";
  const precision = historicalDatePrecision(date);
  if (precision === "century") return `${era}${date.year}世紀`;
  if (precision === "decade") return `${era}${date.year}年代`;
  const month = date.month ? `/${String(date.month).padStart(2, "0")}` : "";
  const day = date.day ? `/${String(date.day).padStart(2, "0")}` : "";
  return `${era}${date.year}${month}${day}`;
}

export function formatApproximateHistoricalDate(
  date: HistoricalDate | null,
  isApproximate: boolean,
) {
  const formatted = formatHistoricalDate(date);
  return isApproximate && date ? `${formatted} 頃` : formatted;
}

function historicalDatePrecision(
  date: Pick<HistoricalDate, "precision" | "month" | "day">,
): HistoricalDatePrecision {
  return (
    date.precision ??
    (date.day !== null ? "day" : date.month !== null ? "month" : "year")
  );
}

export const HISTORICAL_PRECISION_LABELS: Record<
  HistoricalDatePrecision,
  string
> = {
  day: "年月日",
  month: "年月",
  year: "年",
  decade: "年代",
  century: "世紀",
};
