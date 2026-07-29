import { z } from "zod";

import { cloudDraftEntityTypes } from "@/features/autosave/types";

export const cloudDraftEntityTypeSchema = z.enum(cloudDraftEntityTypes);
export const cloudDraftScopeSchema = z.union([z.literal("new"), z.uuid()]);

export const saveCloudDraftSchema = z.strictObject({
  value: z
    .json()
    .refine(
      (value) =>
        value !== null && typeof value === "object" && !Array.isArray(value),
      "下書きはオブジェクト形式で指定してください。",
    ),
  baseVersion: z.iso.datetime({ offset: true }).nullable(),
  fingerprint: z.string().min(1).max(128),
  writerId: z.string().min(1).max(128),
  expectedVersion: z.int().positive().nullable(),
});
