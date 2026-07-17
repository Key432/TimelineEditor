import { z } from "zod";

import { PROJECT_TEMPLATES } from "@/features/projects/types";

const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "説明は2000文字以内で入力してください。")
  .transform((value) => value || null);

export const projectSettingsSchema = z
  .object({
    defaultUncertaintyYears: z.coerce
      .number<number>()
      .int("整数で入力してください。")
      .min(0, "0以上で入力してください。")
      .max(1000, "1000以下で入力してください。"),
    initialStartYear: z.coerce
      .number<number>()
      .int("整数で入力してください。")
      .min(1, "西暦1年以降を入力してください。"),
    initialEndYear: z.coerce
      .number<number>()
      .int("整数で入力してください。")
      .min(1, "西暦1年以降を入力してください。"),
    initialZoomPreset: z.enum(["fit-range", "century", "decade", "year"]),
    timelineDensity: z.enum(["comfortable", "compact"]),
    minimumTimeUnit: z.enum(["year", "month", "day"]),
  })
  .refine((settings) => settings.initialEndYear >= settings.initialStartYear, {
    message: "終了年は開始年以降にしてください。",
    path: ["initialEndYear"],
  });

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "プロジェクト名を入力してください。")
    .max(100, "プロジェクト名は100文字以内で入力してください。"),
  description: optionalDescriptionSchema,
  template: z.enum(PROJECT_TEMPLATES),
  settings: projectSettingsSchema,
});

export const updateProjectSchema = createProjectSchema.omit({ template: true });

export const deleteProjectSchema = z.object({
  confirmationName: z.string(),
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type CreateProjectValues = z.output<typeof createProjectSchema>;
export type UpdateProjectInput = z.output<typeof updateProjectSchema>;
export type ProjectFormInput = z.input<typeof createProjectSchema>;
export type ProjectFormValues = z.output<typeof createProjectSchema>;
