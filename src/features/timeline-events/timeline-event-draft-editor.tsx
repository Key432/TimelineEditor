"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Save } from "lucide-react";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/features/markdown/markdown";
import { ApproximateDateCheckbox } from "@/features/timeline-items/approximate-date-checkbox";
import { HistoricalDateFields } from "@/features/timeline-items/historical-date-fields";
import {
  emptyTimelineEventDraftValues,
  timelineEventDraftSchema,
  type TimelineEventDraftInput,
  type TimelineEventDraftValues,
} from "@/features/timeline-events/validation";

export function TimelineEventDraftEditor({
  value,
  onCancel,
  projectId,
  onSave,
}: {
  value?: TimelineEventDraftInput;
  onCancel: () => void;
  projectId?: string;
  onSave: (value: TimelineEventDraftValues) => void;
}) {
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TimelineEventDraftInput, undefined, TimelineEventDraftValues>({
    resolver: standardSchemaResolver(timelineEventDraftSchema),
    defaultValues: value ?? emptyTimelineEventDraftValues(),
  });
  const date = useWatch({ control, name: "date" });
  const description = useWatch({ control, name: "description" }) ?? "";

  useEffect(
    () => reset(value ?? emptyTimelineEventDraftValues()),
    [reset, value],
  );

  return (
    <div
      aria-label="同時追加するイベントアイテム"
      className="space-y-4 rounded-xl border bg-muted/25 p-4"
      role="group"
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-title`}>タイトル</Label>
        <Input id={`${id}-title`} autoFocus {...register("title")} />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">日付</legend>
        <HistoricalDateFields
          id={`${id}-event-year`}
          labelPrefix="イベント"
          precision={date?.precision ?? "year"}
          value={date ?? undefined}
          eraRegistration={register("date.era")}
          precisionRegistration={register("date.precision")}
          yearRegistration={register("date.year")}
          monthRegistration={register("date.month")}
          dayRegistration={register("date.day")}
          originalTextRegistration={register("date.originalText")}
          approximateControl={
            <ApproximateDateCheckbox
              label="日付はおおよそ"
              {...register("isApproximate")}
            />
          }
        />
        {errors.date ? (
          <p role="alert" className="text-sm text-destructive">
            日付を確認してください。
          </p>
        ) : null}
      </fieldset>
      <MarkdownEditor
        id={`${id}-description`}
        label="本文"
        registration={register("description")}
        rows={6}
        value={description}
        projectId={projectId}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-source`}>出典・参考文献</Label>
          <Textarea id={`${id}-source`} rows={3} {...register("sourceText")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-url`}>外部URL</Label>
          <Input id={`${id}-url`} type="url" {...register("externalUrl")} />
          {errors.externalUrl ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.externalUrl.message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="button" onClick={handleSubmit(onSave)}>
          <Save aria-hidden="true" className="size-4" />
          下書きに追加
        </Button>
      </div>
    </div>
  );
}
