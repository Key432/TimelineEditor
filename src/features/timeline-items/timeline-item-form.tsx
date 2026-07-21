"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Tags } from "lucide-react";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { TimelineItemType } from "@/features/item-types/types";
import {
  createTimelineItem,
  timelineItemKeys,
  updateTimelineItem,
} from "@/features/timeline-items/api";
import type { TimelineItem } from "@/features/timeline-items/types";
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
  onSaved?: (item: TimelineItem) => void;
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
    description: item.description ?? "",
    sourceText: item.sourceText ?? "",
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
  error,
}: {
  prefix: "start" | "end" | "lastConfirmed" | "point";
  formId: string;
  register: ReturnType<
    typeof useForm<TimelineItemInput, undefined, TimelineItemValues>
  >["register"];
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
        <Input
          id={`${formId}-${prefix}-year`}
          aria-label="年"
          inputMode="numeric"
          min={1}
          placeholder="年"
          type="number"
          {...register(`${prefix}.year`)}
        />
        <Input
          aria-label="月"
          inputMode="numeric"
          max={12}
          min={1}
          placeholder="月"
          type="number"
          {...register(`${prefix}.month`)}
        />
        <Input
          aria-label="日"
          inputMode="numeric"
          max={31}
          min={1}
          placeholder="日"
          type="number"
          {...register(`${prefix}.day`)}
        />
      </div>
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
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TimelineItemInput, undefined, TimelineItemValues>({
    resolver: standardSchemaResolver(timelineItemSchema),
    defaultValues: defaults(itemTypes, item),
  });
  const temporalType = useWatch({ control, name: "temporalType" });
  const endDateStatus = useWatch({ control, name: "endDateStatus" });
  const colorOverride = useWatch({ control, name: "colorOverride" });
  const selectedTypeId = useWatch({ control, name: "typeId" });

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
      itemTypes.length === 0 ||
      itemTypes.some((itemType) => itemType.id === selectedTypeId)
    ) {
      return;
    }
    setValue(
      "typeId",
      itemTypes.find((itemType) => itemType.isVisible)?.id ?? itemTypes[0].id,
      { shouldDirty: true, shouldValidate: true },
    );
  }, [itemTypes, selectedTypeId, setValue]);

  const mutation = useMutation({
    mutationFn: (values: TimelineItemValues) =>
      item
        ? updateTimelineItem(projectId, item.id, values)
        : createTimelineItem(projectId, values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: timelineItemKeys.list(projectId),
      });
      queryClient.setQueryData(
        timelineItemKeys.detail(projectId, saved.id),
        saved,
      );
      onSaved?.(saved);
    },
  });

  return (
    <form
      aria-label={
        item ? "タイムラインアイテム編集" : "タイムラインアイテム作成"
      }
      className="space-y-5"
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

      <div className="space-y-2">
        <Label htmlFor={`${formId}-type`}>対象種別</Label>
        <select
          id={`${formId}-type`}
          className={selectClassName}
          {...register("typeId")}
        >
          {itemTypes.map((itemType) => (
            <option key={itemType.id} value={itemType.id}>
              {itemType.name}
              {itemType.isVisible ? "" : "（非表示）"}
            </option>
          ))}
        </select>
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
            対象種別を編集
          </Button>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">時間形式</legend>
        <div className="flex gap-4">
          <Label className="font-normal">
            <input
              type="radio"
              value="range"
              {...register("temporalType", {
                onChange: () => {
                  setValue("start", {
                    year: "",
                    month: "",
                    day: "",
                  });
                  setValue("endDateStatus", "specified");
                  setValue("end", {
                    year: "",
                    month: "",
                    day: "",
                  });
                  setValue("point", null);
                  setValue("isPointApproximate", false);
                },
              })}
            />
            期間
          </Label>
          <Label className="font-normal">
            <input
              type="radio"
              value="point"
              {...register("temporalType", {
                onChange: () => {
                  setValue("start", null);
                  setValue("isStartApproximate", false);
                  setValue("endDateStatus", null);
                  setValue("end", null);
                  setValue("isEndApproximate", false);
                  setValue("lastConfirmed", null);
                },
              })}
            />
            時点
          </Label>
        </div>
      </fieldset>

      {temporalType === "range" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-start-year`}>開始日</Label>
            <DateFields
              error={errors.start?.message ?? errors.start?.root?.message}
              formId={formId}
              prefix="start"
              register={register}
            />
            <Label className="font-normal">
              <input type="checkbox" {...register("isStartApproximate")} />
              開始日はおおよそ
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-end-status`}>終了状態</Label>
            <select
              id={`${formId}-end-status`}
              className={selectClassName}
              {...register("endDateStatus", {
                onChange: (event) => {
                  if (event.target.value !== "specified") {
                    setValue("end", null);
                    setValue("isEndApproximate", false);
                  }
                  if (event.target.value !== "unknown") {
                    setValue("lastConfirmed", null);
                  }
                },
              })}
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
                error={errors.end?.message ?? errors.end?.root?.message}
                formId={formId}
                prefix="end"
                register={register}
              />
              <Label className="font-normal">
                <input type="checkbox" {...register("isEndApproximate")} />
                終了日はおおよそ
              </Label>
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
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-point-year`}>時点日</Label>
          <DateFields
            error={errors.point?.message ?? errors.point?.root?.message}
            formId={formId}
            prefix="point"
            register={register}
          />
          <Label className="font-normal">
            <input type="checkbox" {...register("isPointApproximate")} />
            日付はおおよそ
          </Label>
        </div>
      )}

      <div className="space-y-2">
        <Label className="font-normal">
          <input
            checked={colorOverride !== null}
            type="checkbox"
            onChange={(event) =>
              setValue("colorOverride", event.target.checked ? "#00B0B0" : null)
            }
          />
          対象種別の色を上書き
        </Label>
        {colorOverride ? (
          <Input
            aria-label="個別色"
            className="font-mono uppercase"
            {...register("colorOverride")}
          />
        ) : null}
      </div>

      <Label className="font-normal">
        <input type="checkbox" {...register("isVisible")} />
        タイムラインに表示
      </Label>

      <Separator className="my-7" />
      <div className="space-y-8">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-description`}>本文</Label>
          <Textarea
            id={`${formId}-description`}
            className="min-h-44 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            placeholder="本文を入力…"
            rows={8}
            {...register("description")}
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor={`${formId}-source`}>出典・参考文献</Label>
          <Textarea
            id={`${formId}-source`}
            className="min-h-28 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            placeholder="出典や参考文献を入力…"
            rows={5}
            {...register("sourceText")}
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor={`${formId}-url`}>外部URL</Label>
          <Input
            id={`${formId}-url`}
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            inputMode="url"
            placeholder="https://example.com"
            type="url"
            {...register("externalUrl")}
          />
          {errors.externalUrl ? (
            <p className="text-sm text-destructive">
              {errors.externalUrl.message}
            </p>
          ) : null}
        </div>
      </div>

      {isDirty && !mutation.isPending ? (
        <p className="text-xs text-muted-foreground">
          未保存の変更があります。
        </p>
      ) : null}
      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={mutation.isPending || itemTypes.length === 0}
        type="submit"
      >
        <Save aria-hidden="true" className="size-4" />
        {mutation.isPending
          ? "保存中…"
          : item
            ? "変更を保存"
            : "タイムラインアイテムを作成"}
      </Button>
    </form>
  );
}
