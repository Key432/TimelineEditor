import { z } from "zod";

import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import {
  entityAliasesSchema,
  historicalDateSchema,
} from "@/features/timeline-items/validation";
import type {
  HistoricalDate,
  TimelineItem,
} from "@/features/timeline-items/types";
import { sourceCitationsSchema } from "@/features/sources/validation";
import { customFieldEntriesSchema } from "@/features/classification/validation";

const eventDateSchema = historicalDateSchema;

const nullableText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable();

export const timelineEventSchema = z.object({
  timelineItemIds: z
    .array(z.uuid("親項目を選択してください。"))
    .min(1, "親項目を1件以上選択してください。")
    .max(100, "親項目は100件以内で選択してください。")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "同じ親項目を重複して選択できません。",
    }),
  eventTypeId: z.uuid().nullable().default(null),
  tagIds: z.array(z.uuid()).max(100).default([]),
  customFields: customFieldEntriesSchema.default([]),
  title: z
    .string()
    .trim()
    .min(1, "タイトルを入力してください。")
    .max(200, "タイトルは200文字以内で入力してください。"),
  aliases: entityAliasesSchema.default([]),
  addPreviousTitleToAliases: z.boolean().default(false),
  date: eventDateSchema,
  isApproximate: z.boolean(),
  description: nullableText(20000, "本文は20000文字以内で入力してください。"),
  sourceText: nullableText(10000, "出典は10000文字以内で入力してください。"),
  citations: sourceCitationsSchema,
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
  timelineItemIds: true,
  eventTypeId: true,
  tagIds: true,
  customFields: true,
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
    timelineItemIds: timelineItemId ? [timelineItemId] : [],
    eventTypeId: null,
    tagIds: [],
    customFields: [],
    title: "",
    aliases: [],
    addPreviousTitleToAliases: false,
    date: date ?? {
      era: "ce",
      precision: "year",
      year: "",
      month: "",
      day: "",
      originalText: "",
      calendar: "proleptic_gregorian",
    },
    isApproximate: false,
    description: "",
    sourceText: "",
    citations: [],
    externalUrl: "",
  };
}

export function emptyTimelineEventDraftValues(): TimelineEventDraftInput {
  return {
    title: "",
    aliases: [],
    addPreviousTitleToAliases: false,
    date: {
      era: "ce",
      precision: "year",
      year: "",
      month: "",
      day: "",
      originalText: "",
      calendar: "proleptic_gregorian",
    },
    isApproximate: false,
    description: "",
    sourceText: "",
    citations: [],
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
