import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/features/markdown/markdown";

export function EntityContentFields({
  idPrefix,
  description,
  descriptionValue,
  sourceText,
  externalUrl,
  externalUrlError,
  projectId,
}: {
  idPrefix: string;
  description: UseFormRegisterReturn;
  descriptionValue: string;
  sourceText: UseFormRegisterReturn;
  externalUrl: UseFormRegisterReturn;
  externalUrlError?: FieldError;
  projectId: string;
}) {
  return (
    <>
      <Separator className="my-7" />
      <div className="space-y-8">
        <MarkdownEditor
          id={`${idPrefix}-description`}
          label="本文"
          registration={description}
          value={descriptionValue}
          projectId={projectId}
        />
        <Separator />
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-source`}>出典・参考文献</Label>
          <Textarea
            id={`${idPrefix}-source`}
            className="min-h-28 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            placeholder="出典や参考文献を入力…"
            rows={5}
            {...sourceText}
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-url`}>外部URL</Label>
          <Input
            id={`${idPrefix}-url`}
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            inputMode="url"
            placeholder="https://example.com"
            type="url"
            {...externalUrl}
          />
          {externalUrlError ? (
            <p className="text-sm text-destructive">
              {externalUrlError.message}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
