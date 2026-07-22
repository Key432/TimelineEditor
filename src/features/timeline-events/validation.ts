import { z } from "zod";

import {
  historicalDateOrdinal,
  isValidHistoricalDate,
} from "@/features/timeline-items/historical-date";
import type {
  HistoricalDate,
  TimelineItem,
} from "@/features/timeline-items/types";

const optionalDatePart = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  });

const eventDateSchema = z
  .object({
    year: optionalDatePart,
    month: optionalDatePart,
    day: optionalDatePart,
  })
  .superRefine((date, context) => {
    if (date.year === null) {
      context.addIssue({
        code: "custom",
        path: ["year"],
        message: "年を入力してください。",
      });
      return;
    }
    if (!isValidHistoricalDate(date as HistoricalDate)) {
      context.addIssue({
        code: "custom",
        message: "実在する西暦1年以降の日付を入力してください。",
      });
    }
  })
  .transform((date) => ({
    year: date.year as number,
    month: date.month,
    day: date.day,
  }));

const nullableText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable();

export const timelineEventSchema = z.object({
  timelineItemId: z.uuid("親項目を選択してください。"),
  title: z
    .string()
    .trim()
    .min(1, "タイトルを入力してください。")
    .max(200, "タイトルは200文字以内で入力してください。"),
  date: eventDateSchema,
  isApproximate: z.boolean(),
  description: nullableText(20000, "本文は20000文字以内で入力してください。"),
  sourceText: nullableText(10000, "出典は10000文字以内で入力してください。"),
  externalUrl: z
    .string()
    .trim()
    .max(2048, "URLは2048文字以内で入力してください。")
    .refine((value) => {
      if (!value) return true;
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, "httpまたはhttpsのURLを入力してください。")
    .transform((value) => value || null)
    .nullable(),
});

export const timelineEventDraftSchema = timelineEventSchema.omit({
  timelineItemId: true,
});

export type TimelineEventInput = z.input<typeof timelineEventSchema>;
export type TimelineEventValues = z.output<typeof timelineEventSchema>;
export type TimelineEventDraftInput = z.input<typeof timelineEventDraftSchema>;
export type TimelineEventDraftValues = z.output<
  typeof timelineEventDraftSchema
>;

export function emptyTimelineEventValues(
  timelineItemId = "",
  date: HistoricalDate | null = null,
): TimelineEventInput {
  return {
    timelineItemId,
    title: "",
    date: date ?? { year: "", month: "", day: "" },
    isApproximate: false,
    description: "",
    sourceText: "",
    externalUrl: "",
  };
}

export function emptyTimelineEventDraftValues(): TimelineEventDraftInput {
  return {
    title: "",
    date: { year: "", month: "", day: "" },
    isApproximate: false,
    description: "",
    sourceText: "",
    externalUrl: "",
  };
}

export function isEventOutsideParent(
  date: HistoricalDate,
  parent: Pick<
    TimelineItem,
    "temporalType" | "start" | "endDateStatus" | "end" | "lastConfirmed"
  >,
  currentDate: HistoricalDate,
) {
  if (parent.temporalType !== "range" || !parent.start) return true;
  const value = historicalDateOrdinal(date);
  const start = historicalDateOrdinal(parent.start, "start");
  const endDate =
    parent.endDateStatus === "specified"
      ? parent.end
      : parent.endDateStatus === "ongoing"
        ? currentDate
        : parent.lastConfirmed;
  return (
    value < start ||
    (endDate ? value > historicalDateOrdinal(endDate, "end") : false)
  );
}
