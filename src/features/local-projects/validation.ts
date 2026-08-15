import { z } from "zod";

import { historicalDateSchema } from "@/features/timeline-items/validation";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";

export const localProjectCreateSchema = z.object({
  name: z.string().trim().min(1, "プロジェクト名を入力してください。").max(100),
  description: z.string().trim().max(2000).optional(),
  template: z.enum(["literature", "art", "philosophy", "general", "empty"]),
});

export const localItemCreateSchema = z
  .object({
    title: z.string().trim().min(1, "名称を入力してください。").max(200),
    typeId: z.uuid(),
    temporalType: z.enum(["range", "point"]),
    start: historicalDateSchema,
    endDateStatus: z.enum(["specified", "ongoing", "unknown"]),
    end: historicalDateSchema.optional(),
    description: z.string().trim().max(10000).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.temporalType === "range" &&
      value.endDateStatus === "specified" &&
      value.end === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "終了日を入力してください。",
      });
      return;
    }
    if (
      value.temporalType === "range" &&
      value.endDateStatus !== "ongoing" &&
      value.end &&
      historicalDateOrdinal(value.end, "end") <
        historicalDateOrdinal(value.start, "start")
    ) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message:
          value.endDateStatus === "unknown"
            ? "最終確認日は開始日以降にしてください。"
            : "終了日は開始日以降にしてください。",
      });
    }
  });

export const localEventCreateSchema = z.object({
  title: z.string().trim().min(1, "イベント名を入力してください。").max(200),
  timelineItemIds: z
    .array(z.uuid())
    .min(1, "親タイムラインを選択してください。"),
  date: historicalDateSchema,
  description: z.string().trim().max(10000).optional(),
});
