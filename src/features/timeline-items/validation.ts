import { z } from "zod";

import {
  DEFAULT_CALENDAR,
  historicalDateOrdinal,
  isValidHistoricalDate,
} from "@/features/timeline-items/historical-date";
import type { HistoricalDate } from "@/features/timeline-items/types";
import { sourceCitationsSchema } from "@/features/sources/validation";

const nullableText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable();

export const entityAliasesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "別名を入力してください。")
      .max(200, "別名は200文字以内で入力してください。"),
  )
  .max(20, "別名は20件以内で入力してください。")
  .superRefine((aliases, context) => {
    const normalized = new Set<string>();
    for (const [index, alias] of aliases.entries()) {
      const key = alias.toLocaleLowerCase("ja");
      if (normalized.has(key)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "同じ別名を重複して登録できません。",
        });
      }
      normalized.add(key);
    }
  });

const optionalDatePart = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  });

export const historicalDateSchema = z
  .object({
    era: z.enum(["ce", "bce"]).default("ce"),
    precision: z.enum(["day", "month", "year", "decade", "century"]).optional(),
    year: optionalDatePart,
    month: optionalDatePart,
    day: optionalDatePart,
    originalText: z
      .string()
      .trim()
      .max(200, "原表記は200文字以内で入力してください。")
      .transform((value) => value || null)
      .nullable()
      .default(null),
    calendar: z.string().trim().min(1).max(50).default(DEFAULT_CALENDAR),
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
        message: "時代・精度に合う歴史日付を入力してください。",
      });
    }
  })
  .transform((date) => ({
    era: date.era,
    precision:
      date.precision ??
      (date.day !== null ? "day" : date.month !== null ? "month" : "year"),
    year: date.year as number,
    month:
      date.precision === undefined || ["day", "month"].includes(date.precision)
        ? date.month
        : null,
    day:
      date.precision === undefined || date.precision === "day"
        ? date.day
        : null,
    originalText: date.originalText,
    calendar: date.calendar,
  }));

const blankDatePart = z.union([z.literal(""), z.null(), z.undefined()]);
const blankHistoricalDateSchema = z
  .object({
    era: z.enum(["ce", "bce"]).optional(),
    precision: z.enum(["day", "month", "year", "decade", "century"]).optional(),
    year: blankDatePart,
    month: blankDatePart,
    day: blankDatePart,
    originalText: z.string().optional().nullable(),
    calendar: z.string().optional(),
  })
  .transform(() => null);
const nullableHistoricalDateSchema = z
  .union([
    historicalDateSchema,
    blankHistoricalDateSchema,
    z.null(),
    z.undefined(),
  ])
  .transform((value) => value ?? null);

const baseTimelineItemSchema = z.object({
  typeId: z.uuid("対象種別を選択してください。"),
  title: z
    .string()
    .trim()
    .min(1, "名称を入力してください。")
    .max(200, "名称は200文字以内で入力してください。"),
  aliases: entityAliasesSchema.default([]),
  addPreviousTitleToAliases: z.boolean().default(false),
  description: nullableText(20000, "本文は20000文字以内で入力してください。"),
  sourceText: nullableText(10000, "出典は10000文字以内で入力してください。"),
  citations: sourceCitationsSchema,
  externalUrl: z
    .string()
    .trim()
    .max(2048, "URLは2048文字以内で入力してください。")
    .refine(
      (value) =>
        !value ||
        (() => {
          try {
            const url = new URL(value);
            return url.protocol === "https:" || url.protocol === "http:";
          } catch {
            return false;
          }
        })(),
      "httpまたはhttpsのURLを入力してください。",
    )
    .transform((value) => value || null)
    .nullable(),
  temporalType: z.enum(["range", "point"]),
  colorOverride: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で入力してください。")
    .transform((value) => value.toUpperCase())
    .nullable(),
  isVisible: z.boolean(),
  start: nullableHistoricalDateSchema,
  isStartApproximate: z.boolean(),
  endDateStatus: z.enum(["specified", "ongoing", "unknown"]).nullable(),
  end: nullableHistoricalDateSchema,
  isEndApproximate: z.boolean(),
  lastConfirmed: nullableHistoricalDateSchema,
  point: nullableHistoricalDateSchema,
  isPointApproximate: z.boolean(),
});

export const timelineItemSchema = baseTimelineItemSchema.superRefine(
  (item, context) => {
    if (item.temporalType === "point") {
      if (!item.point) {
        context.addIssue({
          code: "custom",
          path: ["point"],
          message: "時点日を入力してください。",
        });
      }
      return;
    }

    if (!item.start) {
      context.addIssue({
        code: "custom",
        path: ["start"],
        message: "開始日を入力してください。",
      });
    }
    if (!item.endDateStatus) {
      context.addIssue({
        code: "custom",
        path: ["endDateStatus"],
        message: "終了状態を選択してください。",
      });
    }
    if (item.endDateStatus === "specified" && !item.end) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "終了日を入力してください。",
      });
    }
    if (
      item.start &&
      item.endDateStatus === "specified" &&
      item.end &&
      historicalDateOrdinal(item.end, "end") <
        historicalDateOrdinal(item.start, "start")
    ) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "終了日は開始日以降にしてください。",
      });
    }
    if (
      item.start &&
      item.endDateStatus === "unknown" &&
      item.lastConfirmed &&
      historicalDateOrdinal(item.lastConfirmed, "end") <
        historicalDateOrdinal(item.start, "start")
    ) {
      context.addIssue({
        code: "custom",
        path: ["lastConfirmed"],
        message: "最終確認日は開始日以降にしてください。",
      });
    }
  },
);

export const createTimelineItemSchema = timelineItemSchema;
export const updateTimelineItemSchema = timelineItemSchema;

export const moveTimelineItemSchema = z.object({
  manualOrder: z.number().int().min(0),
  typeId: z.uuid().optional(),
});

export type TimelineItemInput = z.input<typeof timelineItemSchema>;
export type TimelineItemValues = z.output<typeof timelineItemSchema>;
export type MoveTimelineItemInput = z.input<typeof moveTimelineItemSchema>;

export function emptyTimelineItemValues(typeId = ""): TimelineItemInput {
  return {
    typeId,
    title: "",
    aliases: [],
    addPreviousTitleToAliases: false,
    description: "",
    sourceText: "",
    citations: [],
    externalUrl: "",
    temporalType: "range",
    colorOverride: null,
    isVisible: true,
    start: {
      era: "ce",
      precision: "year",
      year: "",
      month: "",
      day: "",
      originalText: "",
      calendar: DEFAULT_CALENDAR,
    },
    isStartApproximate: false,
    endDateStatus: "specified",
    end: {
      era: "ce",
      precision: "year",
      year: "",
      month: "",
      day: "",
      originalText: "",
      calendar: DEFAULT_CALENDAR,
    },
    isEndApproximate: false,
    lastConfirmed: null,
    point: null,
    isPointApproximate: false,
  };
}
