"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Save } from "lucide-react";
import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApproximateDateCheckbox } from "@/features/timeline-items/approximate-date-checkbox";
import {
  emptyTimelineEventDraftValues,
  timelineEventDraftSchema,
  type TimelineEventDraftInput,
  type TimelineEventDraftValues,
} from "@/features/timeline-events/validation";

export function TimelineEventDraftEditor({
  value,
  onCancel,
  onSave,
}: {
  value?: TimelineEventDraftInput;
  onCancel: () => void;
  onSave: (value: TimelineEventDraftValues) => void;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TimelineEventDraftInput, undefined, TimelineEventDraftValues>({
    resolver: standardSchemaResolver(timelineEventDraftSchema),
    defaultValues: value ?? emptyTimelineEventDraftValues(),
  });

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
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          data-slot="date-approximate-row"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] gap-2 sm:grid-cols-[minmax(7.5rem,10rem)_4.5rem_4.5rem]">
            <Input
              aria-label="イベント年"
              inputMode="numeric"
              placeholder="年"
              {...register("date.year")}
            />
            <Input
              aria-label="イベント月"
              inputMode="numeric"
              placeholder="月"
              {...register("date.month")}
            />
            <Input
              aria-label="イベント日"
              inputMode="numeric"
              placeholder="日"
              {...register("date.day")}
            />
          </div>
          <ApproximateDateCheckbox
            label="日付はおおよそ"
            {...register("isApproximate")}
          />
        </div>
        {errors.date ? (
          <p role="alert" className="text-sm text-destructive">
            日付を確認してください。
          </p>
        ) : null}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={`${id}-description`}>本文</Label>
        <Textarea
          id={`${id}-description`}
          rows={4}
          {...register("description")}
        />
      </div>
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
