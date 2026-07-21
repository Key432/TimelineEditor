import type { HistoricalDate } from "@/features/timeline-items/types";

export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidHistoricalDate(date: HistoricalDate) {
  if (!Number.isInteger(date.year) || date.year < 1) return false;
  if (date.month === null) return date.day === null;
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12) {
    return false;
  }
  if (date.day === null) return true;
  return (
    Number.isInteger(date.day) &&
    date.day >= 1 &&
    date.day <= daysInMonth(date.year, date.month)
  );
}

export function historicalDateOrdinal(
  date: HistoricalDate,
  boundary: "start" | "end" = "start",
) {
  const month = date.month ?? (boundary === "start" ? 1 : 12);
  const day =
    date.day ?? (boundary === "start" ? 1 : daysInMonth(date.year, month));
  const previousYear = date.year - 1;
  const daysBeforeYear =
    previousYear * 365 +
    Math.floor(previousYear / 4) -
    Math.floor(previousYear / 100) +
    Math.floor(previousYear / 400);
  let daysBeforeMonth = 0;
  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    daysBeforeMonth += daysInMonth(date.year, currentMonth);
  }
  return daysBeforeYear + daysBeforeMonth + day - 1;
}

export function historicalDateFromOrdinal(ordinal: number): HistoricalDate {
  if (!Number.isFinite(ordinal) || ordinal < 0) {
    throw new RangeError("Historical date ordinal must be non-negative.");
  }

  const wholeDay = Math.floor(ordinal);
  let low = 1;
  let high = Math.max(2, Math.floor(wholeDay / 365) + 2);
  while (historicalDateOrdinal({ year: high, month: 1, day: 1 }) <= wholeDay) {
    high *= 2;
  }
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (historicalDateOrdinal({ year: middle, month: 1, day: 1 }) <= wholeDay) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  const year = low;
  let dayOfYear = wholeDay - historicalDateOrdinal({ year, month: 1, day: 1 });
  let month = 1;
  while (dayOfYear >= daysInMonth(year, month)) {
    dayOfYear -= daysInMonth(year, month);
    month += 1;
  }
  return { year, month, day: dayOfYear + 1 };
}

export function formatHistoricalDate(date: HistoricalDate | null) {
  if (!date) return "—";
  const month = date.month ? `/${String(date.month).padStart(2, "0")}` : "";
  const day = date.day ? `/${String(date.day).padStart(2, "0")}` : "";
  return `${date.year}${month}${day}`;
}

export function effectiveItemYear(item: {
  temporalType: "range" | "point";
  start: HistoricalDate | null;
  point: HistoricalDate | null;
}) {
  return item.temporalType === "point"
    ? (item.point?.year ?? 1)
    : (item.start?.year ?? 1);
}
