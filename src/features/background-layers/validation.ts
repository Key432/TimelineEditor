import { z } from "zod";

import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import { historicalDateSchema } from "@/features/timeline-items/validation";

const nullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null)
    .nullable();

export const createBackgroundLayerSchema = z.object({
  name: z.string().trim().min(1, "レイヤー名を入力してください。").max(100),
  description: nullableText(2000).default(null),
  isVisible: z.boolean().default(true),
});

export const updateBackgroundLayerSchema = createBackgroundLayerSchema
  .partial()
  .extend({ sortOrder: z.number().int().min(0).optional() });

export const backgroundPeriodSchema = z
  .object({
    title: z.string().trim().min(1, "期間名を入力してください。").max(200),
    description: nullableText(5000).default(null),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で入力してください。")
      .transform((value) => value.toUpperCase()),
    start: historicalDateSchema,
    end: historicalDateSchema,
    isStartApproximate: z.boolean().default(false),
    isEndApproximate: z.boolean().default(false),
  })
  .superRefine((period, context) => {
    if (
      historicalDateOrdinal(period.end, "end") <
      historicalDateOrdinal(period.start, "start")
    ) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "終了日は開始日以降にしてください。",
      });
    }
  });

export type BackgroundPeriodInput = z.input<typeof backgroundPeriodSchema>;
