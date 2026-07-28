import { z } from "zod";

const nullableText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const optionalUrl = z
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
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const sourceSchema = z.object({
  title: z.string().trim().min(1, "資料名を入力してください。").max(500),
  authors: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  publisher: nullableText(300, "出版社は300文字以内で入力してください。"),
  publicationYear: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === "" || value === null || value === undefined) return null;
      return Number(value);
    })
    .refine(
      (value) =>
        value === null ||
        (Number.isInteger(value) && value >= -999999 && value <= 999999),
      "刊行年を整数で入力してください。",
    ),
  isbn: nullableText(32, "ISBNは32文字以内で入力してください。"),
  url: optionalUrl,
  accessedOn: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "参照日をYYYY-MM-DD形式で入力してください。",
    )
    .transform((value) => value || null)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  citationKey: nullableText(100, "引用キーは100文字以内で入力してください。"),
  notes: nullableText(10000, "注記は10000文字以内で入力してください。"),
});

export const sourceCitationInputSchema = z.object({
  sourceId: z.uuid("資料を選択してください。"),
  pages: nullableText(200, "ページは200文字以内で入力してください。"),
  chapter: nullableText(300, "章は300文字以内で入力してください。"),
  quote: nullableText(5000, "引用箇所は5000文字以内で入力してください。"),
  notes: nullableText(2000, "注記は2000文字以内で入力してください。"),
});

export const sourceCitationsSchema = z
  .array(sourceCitationInputSchema)
  .max(100, "出典は100件以内で関連付けてください。")
  .superRefine((citations, context) => {
    const ids = new Set<string>();
    citations.forEach((citation, index) => {
      if (ids.has(citation.sourceId)) {
        context.addIssue({
          code: "custom",
          path: [index, "sourceId"],
          message: "同じ資料を重複して関連付けできません。",
        });
      }
      ids.add(citation.sourceId);
    });
  })
  .default([]);

export type SourceInput = z.input<typeof sourceSchema>;
export type SourceValues = z.output<typeof sourceSchema>;
export type SourceCitationInput = z.input<typeof sourceCitationInputSchema>;
export type SourceCitationValues = z.output<typeof sourceCitationInputSchema>;
