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
  return date.year * 372 + month * 31 + day;
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
