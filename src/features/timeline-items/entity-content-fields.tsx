import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/features/markdown/markdown";
import { SourceCitationFields } from "@/features/sources/source-citation-fields";
import type { SourceCitationInput } from "@/features/sources/validation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function EntityContentFields({
  idPrefix,
  description,
  descriptionValue,
  sourceText,
  externalUrl,
  externalUrlError,
  projectId,
  citations,
  onCitationsChange,
}: {
  idPrefix: string;
  description: UseFormRegisterReturn;
  descriptionValue: string;
  sourceText: UseFormRegisterReturn;
  externalUrl: UseFormRegisterReturn;
  externalUrlError?: FieldError;
  projectId: string;
  citations?: SourceCitationInput[];
  onCitationsChange?: (value: SourceCitationInput[]) => void;
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
          <Label>出典・参考文献</Label>
          {onCitationsChange ? (
            <Tabs defaultValue="free-text">
              <TabsList aria-label="出典の登録方法">
                <TabsTrigger value="free-text">自由記述</TabsTrigger>
                <TabsTrigger value="structured">
                  詳細登録{citations?.length ? `（${citations.length}）` : ""}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="free-text" className="pt-3">
                <Label className="sr-only" htmlFor={`${idPrefix}-source`}>
                  出典・参考文献
                </Label>
                <Textarea
                  id={`${idPrefix}-source`}
                  className="min-h-28 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  placeholder="出典や参考文献を自由に入力…"
                  rows={5}
                  {...sourceText}
                />
              </TabsContent>
              <TabsContent value="structured" className="pt-3">
                <SourceCitationFields
                  projectId={projectId}
                  value={citations ?? []}
                  onChange={onCitationsChange}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <Textarea
              id={`${idPrefix}-source`}
              aria-label="出典・参考文献"
              className="min-h-28 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="出典や参考文献を入力…"
              rows={5}
              {...sourceText}
            />
          )}
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
