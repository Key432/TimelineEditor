"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createTimelineEvent,
  timelineEventKeys,
  updateTimelineEvent,
} from "@/features/timeline-events/api";
import type { TimelineEvent } from "@/features/timeline-events/types";
import {
  emptyTimelineEventValues,
  isEventOutsideParent,
  timelineEventSchema,
  type TimelineEventInput,
  type TimelineEventValues,
} from "@/features/timeline-events/validation";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";

export function TimelineEventForm({
  projectId,
  rangeItems,
  currentDate,
  event,
  initialParentId,
  initialDate,
  onSaved,
  onDirtyChange,
}: {
  projectId: string;
  rangeItems: TimelineItemSummary[];
  currentDate: HistoricalDate;
  event?: TimelineEvent;
  initialParentId?: string;
  initialDate?: HistoricalDate;
  onSaved?: (event: TimelineEvent) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const defaults: TimelineEventInput = event
    ? {
        timelineItemId: event.timelineItemId,
        title: event.title,
        date: event.date,
        isApproximate: event.isApproximate,
        description: event.description ?? "",
        sourceText: event.sourceText ?? "",
        externalUrl: event.externalUrl ?? "",
      }
    : emptyTimelineEventValues(initialParentId, initialDate ?? null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<TimelineEventInput, undefined, TimelineEventValues>({
    resolver: standardSchemaResolver(timelineEventSchema),
    defaultValues: defaults,
  });

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const mutation = useMutation({
    mutationFn: (values: TimelineEventValues) =>
      event
        ? updateTimelineEvent(projectId, event.id, values)
        : createTimelineEvent(projectId, values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: timelineEventKeys.list(projectId),
      });
      queryClient.setQueryData(
        timelineEventKeys.detail(projectId, saved.id),
        saved,
      );
      onSaved?.(saved);
    },
  });
  const parentId = useWatch({ control, name: "timelineItemId" });
  const date = useWatch({ control, name: "date" });
  const parent = rangeItems.find((item) => item.id === parentId);
  const parsedDate = date
    ? {
        year: Number(date.year),
        month:
          date.month === "" || date.month == null ? null : Number(date.month),
        day: date.day === "" || date.day == null ? null : Number(date.day),
      }
    : null;
  const outside =
    parent &&
    parsedDate &&
    Number.isInteger(parsedDate.year) &&
    isEventOutsideParent(parsedDate, parent, currentDate);

  return (
    <form
      aria-label={event ? "イベントアイテム編集" : "イベントアイテム作成"}
      className="space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="space-y-2">
        <Label htmlFor="event-parent">親タイムラインアイテム</Label>
        <select
          id="event-parent"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          {...register("timelineItemId")}
        >
          <option value="">選択してください</option>
          {rangeItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        {errors.timelineItemId ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.timelineItemId.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="event-title">タイトル</Label>
        <Input id="event-title" {...register("title")} />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">日付</legend>
        <div className="grid grid-cols-3 gap-2">
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
        {errors.date ? (
          <p role="alert" className="text-sm text-destructive">
            日付を確認してください。
          </p>
        ) : null}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isApproximate")} />
        日付はおおよそ
      </label>
      {outside ? (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900"
        >
          親項目の期間外です。没後刊行・回顧展などの場合はこのまま保存できます。
        </p>
      ) : null}
      <Separator className="my-7" />
      <div className="space-y-8">
        <div className="space-y-2">
          <Label htmlFor="event-description">本文</Label>
          <Textarea
            id="event-description"
            className="min-h-44 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            placeholder="本文を入力…"
            rows={7}
            {...register("description")}
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="event-source">出典・参考文献</Label>
          <Textarea
            id="event-source"
            className="min-h-28 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            placeholder="出典や参考文献を入力…"
            rows={4}
            {...register("sourceText")}
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="event-url">外部URL</Label>
          <Input
            id="event-url"
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            placeholder="https://example.com"
            type="url"
            {...register("externalUrl")}
          />
        </div>
      </div>
      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}
      <Button disabled={mutation.isPending} type="submit">
        {mutation.isPending
          ? "保存中…"
          : event
            ? "変更を保存"
            : "イベントアイテムを作成"}
      </Button>
    </form>
  );
}
