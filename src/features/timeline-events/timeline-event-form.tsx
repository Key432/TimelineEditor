"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalDraftStatusView } from "@/features/autosave/local-draft-status";
import { useLocalDraft } from "@/features/autosave/use-local-draft";
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
import { ApproximateDateCheckbox } from "@/features/timeline-items/approximate-date-checkbox";
import { HistoricalDateFields } from "@/features/timeline-items/historical-date-fields";
import { EntityContentFields } from "@/features/timeline-items/entity-content-fields";
import { EntityAliasFields } from "@/features/timeline-items/entity-alias-fields";

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
        aliases: event.aliases,
        addPreviousTitleToAliases: false,
        date: event.date,
        isApproximate: event.isApproximate,
        description: event.description ?? "",
        sourceText: event.sourceText ?? "",
        citations: (event.citations ?? []).map(
          ({ sourceId, pages, chapter, quote, notes }) => ({
            sourceId,
            pages: pages ?? "",
            chapter: chapter ?? "",
            quote: quote ?? "",
            notes: notes ?? "",
          }),
        ),
        externalUrl: event.externalUrl ?? "",
      }
    : emptyTimelineEventValues(initialParentId, initialDate ?? null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TimelineEventInput, undefined, TimelineEventValues>({
    resolver: standardSchemaResolver(timelineEventSchema),
    defaultValues: defaults,
  });

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
  const formValues = useWatch({ control }) as TimelineEventInput;

  const restoreDraft = useCallback(
    (draft: TimelineEventInput) => {
      reset(draft, { keepDefaultValues: true });
    },
    [reset],
  );
  const localDraft = useLocalDraft({
    baseVersion: event?.updatedAt ?? null,
    dirty: isDirty,
    draftKey: `timeline-event:${projectId}:${event?.id ?? "new"}`,
    projectId,
    entityType: "timeline_event",
    draftScope: event?.id ?? "new",
    onRestore: restoreDraft,
    value: formValues,
  });

  const mutation = useMutation({
    mutationFn: (values: TimelineEventValues) =>
      event
        ? updateTimelineEvent(projectId, event.id, values, event.updatedAt)
        : createTimelineEvent(projectId, values),
    onSuccess: async (saved) => {
      await localDraft.discard();
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
  const description = useWatch({ control, name: "description" }) ?? "";
  const aliases = useWatch({ control, name: "aliases" }) ?? [];
  const title = useWatch({ control, name: "title" }) ?? "";
  const citations = useWatch({ control, name: "citations" }) ?? [];
  const parent = rangeItems.find((item) => item.id === parentId);
  const parsedDate = date
    ? {
        era: date.era ?? "ce",
        precision: date.precision ?? "year",
        year: Number(date.year),
        month:
          date.month === "" || date.month == null ? null : Number(date.month),
        day: date.day === "" || date.day == null ? null : Number(date.day),
        originalText: date.originalText || null,
        calendar: date.calendar || "proleptic_gregorian",
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
      onBlurCapture={localDraft.flush}
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
      <EntityAliasFields
        aliases={aliases}
        error={errors.aliases?.message}
        id="event-aliases"
        onChange={(next) =>
          setValue("aliases", next, { shouldDirty: true, shouldValidate: true })
        }
      />
      {event && title.trim() && title.trim() !== event.title ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            className="size-4 accent-primary"
            type="checkbox"
            {...register("addPreviousTitleToAliases")}
          />
          変更前のタイトル「{event.title}」を別名へ追加
        </label>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">日付</legend>
        <HistoricalDateFields
          id="event-year"
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
      {outside ? (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900"
        >
          親項目の期間外です。没後刊行・回顧展などの場合はこのまま保存できます。
        </p>
      ) : null}
      <EntityContentFields
        citations={citations}
        description={register("description")}
        descriptionValue={description}
        externalUrl={register("externalUrl")}
        externalUrlError={errors.externalUrl}
        idPrefix="event"
        sourceText={register("sourceText")}
        projectId={projectId}
        onCitationsChange={(next) =>
          setValue("citations", next, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />
      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}
      <LocalDraftStatusView
        status={localDraft.status}
        onRetry={localDraft.retry}
        onUseCloudVersion={localDraft.useCloudVersion}
        onUseThisDeviceVersion={localDraft.useThisDeviceVersion}
        canUseCloudVersion={localDraft.canUseCloudVersion}
      />
      <div className="sticky bottom-0 border-t bg-background/95 pt-4 pb-1 backdrop-blur">
        <Button
          className="w-full"
          disabled={mutation.isPending || Boolean(event && !isDirty)}
          type="submit"
        >
          {mutation.isPending
            ? "保存中…"
            : event
              ? "変更を保存"
              : "イベントアイテムを作成"}
        </Button>
      </div>
    </form>
  );
}
