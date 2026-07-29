"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Tags, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  CustomFieldsEditor,
  TagMultiSelect,
} from "@/features/classification/entity-classification-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalDraftStatusView } from "@/features/autosave/local-draft-status";
import { useLocalDraft } from "@/features/autosave/use-local-draft";
import type { TimelineItemType } from "@/features/item-types/types";
import { itemTypeKeys, listItemTypes } from "@/features/item-types/api";
import { TimelineItemTypeSelect } from "@/features/item-types/item-type-select";
import { timelineEventKeys } from "@/features/timeline-events/api";
import { TimelineEventDraftEditor } from "@/features/timeline-events/timeline-event-draft-editor";
import type { TimelineEventDraftValues } from "@/features/timeline-events/validation";
import { ApproximateDateCheckbox } from "@/features/timeline-items/approximate-date-checkbox";
import { EntityAliasFields } from "@/features/timeline-items/entity-alias-fields";
import { EntityContentFields } from "@/features/timeline-items/entity-content-fields";
import { HistoricalDateFields } from "@/features/timeline-items/historical-date-fields";
import { formatHistoricalDate } from "@/features/timeline-items/historical-date";
import {
  createTimelineItem,
  timelineItemKeys,
  updateTimelineItem,
} from "@/features/timeline-items/api";
import type {
  TimelineEventCreationFailure,
  TimelineItem,
} from "@/features/timeline-items/types";
import {
  emptyTimelineItemValues,
  timelineItemSchema,
  type TimelineItemInput,
  type TimelineItemValues,
} from "@/features/timeline-items/validation";

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type TimelineItemFormProps = {
  projectId: string;
  itemTypes: TimelineItemType[];
  item?: TimelineItem;
  onSaved?: (
    item: TimelineItem,
    failedEvents?: TimelineEventCreationFailure[],
  ) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onEditItemTypes?: () => void;
};

function defaults(
  itemTypes: TimelineItemType[],
  item?: TimelineItem,
): TimelineItemInput {
  if (!item) {
    return emptyTimelineItemValues(
      itemTypes.find((itemType) => itemType.isVisible)?.id ??
        itemTypes[0]?.id ??
        "",
    );
  }
  return {
    typeId: item.typeId,
    title: item.title,
    aliases: item.aliases,
    tagIds: (item.tags ?? []).map((tag) => tag.id),
    customFields: item.customFields ?? [],
    addPreviousTitleToAliases: false,
    description: item.description ?? "",
    sourceText: item.sourceText ?? "",
    citations: (item.citations ?? []).map(
      ({ sourceId, pages, chapter, quote, notes }) => ({
        sourceId,
        pages: pages ?? "",
        chapter: chapter ?? "",
        quote: quote ?? "",
        notes: notes ?? "",
      }),
    ),
    externalUrl: item.externalUrl ?? "",
    temporalType: item.temporalType,
    colorOverride: item.colorOverride,
    isVisible: item.isVisible,
    start: item.start,
    isStartApproximate: item.isStartApproximate,
    endDateStatus: item.endDateStatus,
    end: item.end,
    isEndApproximate: item.isEndApproximate,
    lastConfirmed: item.lastConfirmed,
    point: item.point,
    isPointApproximate: item.isPointApproximate,
  };
}

function DateFields({
  prefix,
  formId,
  register,
  control,
  error,
  approximateLabel,
  approximateRegistration,
}: {
  prefix: "start" | "end" | "lastConfirmed" | "point";
  formId: string;
  register: ReturnType<
    typeof useForm<TimelineItemInput, undefined, TimelineItemValues>
  >["register"];
  control: ReturnType<
    typeof useForm<TimelineItemInput, undefined, TimelineItemValues>
  >["control"];
  error?: string;
  approximateLabel?: string;
  approximateRegistration?: ReturnType<
    ReturnType<
      typeof useForm<TimelineItemInput, undefined, TimelineItemValues>
    >["register"]
  >;
}) {
  const date = useWatch({ control, name: prefix });
  const precision = date?.precision ?? "year";
  return (
    <div className="space-y-2">
      <HistoricalDateFields
        id={`${formId}-${prefix}-year`}
        precision={precision}
        value={date ?? undefined}
        eraRegistration={register(`${prefix}.era`)}
        precisionRegistration={register(`${prefix}.precision`)}
        yearRegistration={register(`${prefix}.year`)}
        monthRegistration={register(`${prefix}.month`)}
        dayRegistration={register(`${prefix}.day`)}
        originalTextRegistration={register(`${prefix}.originalText`)}
        approximateControl={
          approximateLabel && approximateRegistration ? (
            <ApproximateDateCheckbox
              label={approximateLabel}
              {...approximateRegistration}
            />
          ) : null
        }
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function TimelineItemForm({
  projectId,
  itemTypes,
  item,
  onSaved,
  onDirtyChange,
  onEditItemTypes,
}: TimelineItemFormProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const { data: currentItemTypes = itemTypes } = useQuery({
    queryKey: itemTypeKeys.list(projectId),
    queryFn: () => listItemTypes(projectId),
    initialData: itemTypes,
  });
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TimelineItemInput, undefined, TimelineItemValues>({
    resolver: standardSchemaResolver(timelineItemSchema),
    defaultValues: defaults(itemTypes, item),
  });
  const temporalType = useWatch({ control, name: "temporalType" });
  const formValues = useWatch({ control }) as TimelineItemInput;
  const endDateStatus = useWatch({ control, name: "endDateStatus" });
  const colorOverride = useWatch({ control, name: "colorOverride" });
  const selectedTypeId = useWatch({ control, name: "typeId" });
  const description = useWatch({ control, name: "description" }) ?? "";
  const aliases = useWatch({ control, name: "aliases" }) ?? [];
  const title = useWatch({ control, name: "title" }) ?? "";
  const citations = useWatch({ control, name: "citations" }) ?? [];
  const tagIds = useWatch({ control, name: "tagIds" }) ?? [];
  const customFields = useWatch({ control, name: "customFields" }) ?? [];
  const [eventDrafts, setEventDrafts] = useState<TimelineEventDraftValues[]>(
    [],
  );
  const [editingEvent, setEditingEvent] = useState<number | "new" | null>(null);
  const draftValue = { values: formValues, eventDrafts };
  const restoreDraft = useCallback(
    (draft: typeof draftValue) => {
      reset(draft.values, { keepDefaultValues: true });
      setEventDrafts(draft.eventDrafts);
    },
    [reset],
  );
  const localDraft = useLocalDraft({
    baseVersion: item?.updatedAt ?? null,
    dirty: isDirty || eventDrafts.length > 0,
    draftKey: `timeline-item:${projectId}:${item?.id ?? "new"}`,
    projectId,
    entityType: "timeline_item",
    draftScope: item?.id ?? "new",
    onRestore: restoreDraft,
    value: draftValue,
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  useEffect(() => {
    if (
      currentItemTypes.length === 0 ||
      currentItemTypes.some((itemType) => itemType.id === selectedTypeId)
    ) {
      return;
    }
    setValue(
      "typeId",
      currentItemTypes.find((itemType) => itemType.isVisible)?.id ??
        currentItemTypes[0].id,
      { shouldDirty: true, shouldValidate: true },
    );
  }, [currentItemTypes, selectedTypeId, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: TimelineItemValues) => {
      if (item) {
        return {
          item: await updateTimelineItem(
            projectId,
            item.id,
            values,
            item.updatedAt,
          ),
          failedEvents: [],
        };
      }
      return createTimelineItem(projectId, values, eventDrafts);
    },
    onSuccess: async (saved) => {
      await localDraft.discard();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: timelineItemKeys.list(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: timelineEventKeys.list(projectId),
        }),
      ]);
      queryClient.setQueryData(
        timelineItemKeys.detail(projectId, saved.item.id),
        saved.item,
      );
      onSaved?.(saved.item, saved.failedEvents);
    },
  });

  function changeTemporalType(next: "range" | "point") {
    if (next === temporalType) return;
    if (next === "point") {
      setValue("point", getValues("start"), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("isPointApproximate", getValues("isStartApproximate"), {
        shouldDirty: true,
      });
    } else {
      setValue("start", getValues("point"), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("isStartApproximate", getValues("isPointApproximate"), {
        shouldDirty: true,
      });
      if (!getValues("endDateStatus"))
        setValue("endDateStatus", "specified", { shouldDirty: true });
    }
    setValue("temporalType", next, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form
      aria-label={
        item ? "タイムラインアイテム編集" : "タイムラインアイテム作成"
      }
      className="space-y-5"
      onBlurCapture={localDraft.flush}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="space-y-2">
        <Label htmlFor={`${formId}-title`}>名称</Label>
        <Input
          id={`${formId}-title`}
          aria-invalid={Boolean(errors.title)}
          autoFocus={!item}
          {...register("title")}
        />
        {errors.title ? (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      <EntityAliasFields
        aliases={aliases}
        error={errors.aliases?.message}
        id={`${formId}-aliases`}
        onChange={(next) =>
          setValue("aliases", next, { shouldDirty: true, shouldValidate: true })
        }
      />
      {item && title.trim() && title.trim() !== item.title ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            className="size-4 accent-primary"
            type="checkbox"
            {...register("addPreviousTitleToAliases")}
          />
          変更前の名称「{item.title}」を別名へ追加
        </label>
      ) : null}

      <div className="space-y-2">
        <TimelineItemTypeSelect
          initialItemTypes={itemTypes}
          projectId={projectId}
          value={selectedTypeId || null}
          onChange={(next) =>
            setValue("typeId", next, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        {errors.typeId ? (
          <p className="text-sm text-destructive">{errors.typeId.message}</p>
        ) : null}
        {onEditItemTypes ? (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={onEditItemTypes}
          >
            <Tags aria-hidden="true" className="size-4" />
            種別・タグ・カスタムフィールドを管理
          </Button>
        ) : null}
      </div>

      <TagMultiSelect
        projectId={projectId}
        value={tagIds}
        onChange={(next) =>
          setValue("tagIds", next, { shouldDirty: true, shouldValidate: true })
        }
      />
      <CustomFieldsEditor
        projectId={projectId}
        entityType="timeline_item"
        targetTypeId={selectedTypeId || null}
        value={customFields}
        onChange={(next) =>
          setValue("customFields", next, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">時間形式</legend>
        <div
          aria-label="時間形式"
          className="grid grid-cols-2 rounded-lg bg-muted p-1"
          role="group"
        >
          <Button
            aria-pressed={temporalType === "range"}
            type="button"
            variant={temporalType === "range" ? "secondary" : "ghost"}
            onClick={() => changeTemporalType("range")}
          >
            期間
          </Button>
          <Button
            aria-pressed={temporalType === "point"}
            type="button"
            variant={temporalType === "point" ? "secondary" : "ghost"}
            onClick={() => changeTemporalType("point")}
          >
            時点
          </Button>
        </div>
      </fieldset>

      {temporalType === "range" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-start-year`}>開始日</Label>
            <DateFields
              approximateLabel="開始日はおおよそ"
              approximateRegistration={register("isStartApproximate")}
              error={errors.start?.message ?? errors.start?.root?.message}
              formId={formId}
              prefix="start"
              register={register}
              control={control}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-end-status`}>終了状態</Label>
            <select
              id={`${formId}-end-status`}
              className={selectClassName}
              {...register("endDateStatus")}
            >
              <option value="specified">終了日あり</option>
              <option value="ongoing">継続中</option>
              <option value="unknown">終了時期不明</option>
            </select>
          </div>
          {endDateStatus === "specified" ? (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-end-year`}>終了日</Label>
              <DateFields
                approximateLabel="終了日はおおよそ"
                approximateRegistration={register("isEndApproximate")}
                error={errors.end?.message ?? errors.end?.root?.message}
                formId={formId}
                prefix="end"
                register={register}
                control={control}
              />
            </div>
          ) : null}
          {endDateStatus === "unknown" ? (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-lastConfirmed-year`}>
                最終確認日（任意）
              </Label>
              <DateFields
                error={
                  errors.lastConfirmed?.message ??
                  errors.lastConfirmed?.root?.message
                }
                formId={formId}
                prefix="lastConfirmed"
                register={register}
                control={control}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-point-year`}>時点日</Label>
          <DateFields
            approximateLabel="日付はおおよそ"
            approximateRegistration={register("isPointApproximate")}
            error={errors.point?.message ?? errors.point?.root?.message}
            formId={formId}
            prefix="point"
            register={register}
            control={control}
          />
        </div>
      )}

      <div className="rounded-lg border bg-muted/20" data-slot="color-override">
        <Label className="flex h-9 items-center gap-2 px-3 text-sm font-normal">
          <input
            checked={colorOverride !== null}
            className="size-4 accent-primary"
            type="checkbox"
            onChange={(event) =>
              setValue(
                "colorOverride",
                event.target.checked
                  ? (currentItemTypes.find((type) => type.id === selectedTypeId)
                      ?.defaultColor ?? "#00B0B0")
                  : null,
                { shouldDirty: true, shouldValidate: true },
              )
            }
          />
          タイムライン種別の色を上書き
        </Label>
        {colorOverride ? (
          <div className="flex items-center gap-3 border-t bg-background/60 p-3">
            <Input
              aria-label="個別色カラーピッカー"
              className="h-10 w-14 cursor-pointer p-1"
              type="color"
              value={
                /^#[0-9A-Fa-f]{6}$/.test(colorOverride)
                  ? colorOverride
                  : "#000000"
              }
              onChange={(event) =>
                setValue("colorOverride", event.target.value.toUpperCase(), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <Input
              aria-label="個別色"
              className="font-mono uppercase"
              value={colorOverride}
              onChange={(event) =>
                setValue("colorOverride", event.target.value.toUpperCase(), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </div>
        ) : null}
      </div>

      <Label className="flex h-9 items-center gap-2 rounded-lg border bg-muted/20 px-3 text-sm font-normal">
        <input
          className="size-4 accent-primary"
          type="checkbox"
          {...register("isVisible")}
        />
        タイムラインに表示
      </Label>

      {!item ? (
        <section
          className="space-y-3 rounded-xl border p-4"
          aria-labelledby={`${formId}-events`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id={`${formId}-events`} className="font-medium">
                同時に追加するイベント
              </h2>
            </div>
            <Button
              disabled={temporalType !== "range" || editingEvent !== null}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setEditingEvent("new")}
            >
              <Plus aria-hidden="true" className="size-4" />
              イベントを追加
            </Button>
          </div>
          {temporalType !== "range" ? (
            <p className="text-sm text-muted-foreground">
              イベントは期間型の親にのみ追加できます。
            </p>
          ) : null}
          {eventDrafts.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {eventDrafts.map((draft, index) => (
                <li
                  key={`${draft.title}-${index}`}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {draft.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatHistoricalDate(draft.date)}
                    </p>
                  </div>
                  <Button
                    aria-label={`${draft.title}を編集`}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setEditingEvent(index)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label={`${draft.title}を削除`}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setEventDrafts((current) =>
                        current.filter((_, candidate) => candidate !== index),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {editingEvent !== null ? (
            <TimelineEventDraftEditor
              value={
                editingEvent === "new" ? undefined : eventDrafts[editingEvent]
              }
              onCancel={() => setEditingEvent(null)}
              onSave={(draft) => {
                setEventDrafts((current) =>
                  editingEvent === "new"
                    ? [...current, draft]
                    : current.map((value, index) =>
                        index === editingEvent ? draft : value,
                      ),
                );
                setEditingEvent(null);
              }}
              projectId={projectId}
            />
          ) : null}
        </section>
      ) : null}

      <EntityContentFields
        citations={citations}
        description={register("description")}
        descriptionValue={description}
        externalUrl={register("externalUrl")}
        externalUrlError={errors.externalUrl}
        idPrefix={formId}
        sourceText={register("sourceText")}
        projectId={projectId}
        onCitationsChange={(next) =>
          setValue("citations", next, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />

      <LocalDraftStatusView
        status={localDraft.status}
        onRetry={localDraft.retry}
        onUseCloudVersion={localDraft.useCloudVersion}
        onUseThisDeviceVersion={localDraft.useThisDeviceVersion}
        canUseCloudVersion={localDraft.canUseCloudVersion}
      />
      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-1 border-t bg-background/95 px-1 pt-4 pb-1 backdrop-blur">
        <Button
          className="w-full"
          disabled={
            mutation.isPending ||
            currentItemTypes.length === 0 ||
            Boolean(item && !isDirty)
          }
          type="submit"
        >
          <Save aria-hidden="true" className="size-4" />
          {mutation.isPending
            ? "保存中…"
            : item
              ? "変更を保存"
              : "タイムラインアイテムを作成"}
        </Button>
      </div>
    </form>
  );
}
