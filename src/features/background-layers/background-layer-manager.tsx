"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  backgroundLayerKeys,
  createBackgroundLayer,
  deleteBackgroundLayer,
  deleteBackgroundPeriod,
  listBackgroundLayers,
  saveBackgroundPeriod,
  updateBackgroundLayer,
} from "@/features/background-layers/api";
import { overlappingBackgroundPeriodIds } from "@/features/background-layers/overlap";
import type {
  TimelineBackgroundLayer,
  TimelineBackgroundPeriod,
} from "@/features/background-layers/types";
import {
  backgroundPeriodSchema,
  createBackgroundLayerSchema,
  type BackgroundPeriodInput,
} from "@/features/background-layers/validation";
import { HistoricalDateFields } from "@/features/timeline-items/historical-date-fields";
import { DEFAULT_CALENDAR } from "@/features/timeline-items/historical-date";

const emptyDate = {
  era: "ce" as const,
  precision: "year" as const,
  year: "",
  month: "",
  day: "",
  originalText: "",
  calendar: DEFAULT_CALENDAR,
};
const emptyPeriod: BackgroundPeriodInput = {
  title: "",
  description: "",
  color: "#7C9A92",
  start: { ...emptyDate },
  end: { ...emptyDate },
  isStartApproximate: false,
  isEndApproximate: false,
};

function PeriodForm({
  projectId,
  layerId,
  period,
  onDone,
}: {
  projectId: string;
  layerId: string;
  period?: TimelineBackgroundPeriod;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const defaults: BackgroundPeriodInput = period
    ? {
        title: period.title,
        description: period.description ?? "",
        color: period.color,
        start: period.start,
        end: period.end,
        isStartApproximate: period.isStartApproximate,
        isEndApproximate: period.isEndApproximate,
      }
    : emptyPeriod;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BackgroundPeriodInput>({
    resolver: standardSchemaResolver(backgroundPeriodSchema),
    defaultValues: defaults,
  });
  const start = useWatch({ control, name: "start" });
  const end = useWatch({ control, name: "end" });
  const mutation = useMutation({
    mutationFn: (values: BackgroundPeriodInput) =>
      saveBackgroundPeriod(projectId, layerId, period?.id ?? null, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: backgroundLayerKeys.list(projectId),
      });
      onDone();
    },
  });
  return (
    <form
      className="space-y-3 rounded-md border bg-muted/20 p-3"
      aria-label={period ? `${period.title}を編集` : "背景期間を追加"}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <Input
          aria-label="期間名"
          placeholder="例：明治時代"
          {...register("title")}
        />
        <Input aria-label="期間色" type="color" {...register("color")} />
      </div>
      <Textarea
        aria-label="期間の説明"
        placeholder="説明（任意）"
        {...register("description")}
      />
      <div className="space-y-1">
        <span className="text-sm font-medium">開始</span>
        <HistoricalDateFields
          id={`${layerId}-start`}
          precision={start?.precision ?? "year"}
          value={start}
          eraRegistration={register("start.era")}
          precisionRegistration={register("start.precision")}
          yearRegistration={register("start.year")}
          monthRegistration={register("start.month")}
          dayRegistration={register("start.day")}
          originalTextRegistration={register("start.originalText")}
          approximateControl={
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isStartApproximate")} />
              おおよそ
            </label>
          }
        />
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium">終了</span>
        <HistoricalDateFields
          id={`${layerId}-end`}
          precision={end?.precision ?? "year"}
          value={end}
          eraRegistration={register("end.era")}
          precisionRegistration={register("end.precision")}
          yearRegistration={register("end.year")}
          monthRegistration={register("end.month")}
          dayRegistration={register("end.day")}
          originalTextRegistration={register("end.originalText")}
          approximateControl={
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isEndApproximate")} />
              おおよそ
            </label>
          }
        />
      </div>
      {errors.root?.message || errors.end?.message ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.root?.message ?? errors.end?.message}
        </p>
      ) : null}
      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          キャンセル
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {period ? "期間を更新" : "期間を追加"}
        </Button>
      </div>
    </form>
  );
}

function LayerCard({
  projectId,
  layer,
  index,
  count,
}: {
  projectId: string;
  layer: TimelineBackgroundLayer;
  index: number;
  count: number;
}) {
  const queryClient = useQueryClient();
  const [editingPeriod, setEditingPeriod] = useState<string | "new" | null>(
    null,
  );
  const overlaps = overlappingBackgroundPeriodIds(layer.periods);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: backgroundLayerKeys.list(projectId),
    });
  const update = useMutation({
    mutationFn: (input: Parameters<typeof updateBackgroundLayer>[2]) =>
      updateBackgroundLayer(projectId, layer.id, input),
    onSuccess: refresh,
  });
  const removeLayer = useMutation({
    mutationFn: () => deleteBackgroundLayer(projectId, layer.id),
    onSuccess: refresh,
  });
  const removePeriod = useMutation({
    mutationFn: (periodId: string) =>
      deleteBackgroundPeriod(projectId, layer.id, periodId),
    onSuccess: refresh,
  });
  const { register, handleSubmit } = useForm({
    resolver: standardSchemaResolver(createBackgroundLayerSchema),
    defaultValues: {
      name: layer.name,
      description: layer.description,
      isVisible: layer.isVisible,
    },
  });
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <form
        className="grid gap-2 sm:grid-cols-[1fr_auto]"
        onSubmit={handleSubmit((values) => update.mutate(values))}
      >
        <div className="space-y-2">
          <Input
            aria-label={`${layer.name}のレイヤー名`}
            {...register("name")}
          />
          <Textarea
            aria-label={`${layer.name}の説明`}
            {...register("description")}
          />
        </div>
        <div className="flex items-start gap-1">
          <Button
            aria-label={`${layer.name}を上へ移動`}
            disabled={index === 0}
            size="icon-sm"
            type="button"
            variant="ghost"
            onClick={() => update.mutate({ sortOrder: index - 1 })}
          >
            <ArrowUp />
          </Button>
          <Button
            aria-label={`${layer.name}を下へ移動`}
            disabled={index === count - 1}
            size="icon-sm"
            type="button"
            variant="ghost"
            onClick={() => update.mutate({ sortOrder: index + 1 })}
          >
            <ArrowDown />
          </Button>
          <Button size="sm" type="submit" variant="outline">
            保存
          </Button>
          <Button
            aria-label={`${layer.name}を削除`}
            size="icon-sm"
            type="button"
            variant="ghost"
            onClick={() => {
              if (window.confirm(`「${layer.name}」と期間を削除しますか？`))
                removeLayer.mutate();
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </form>
      <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span>
          <span className="font-medium">タイムラインに表示</span>
          <span className="ml-2 text-muted-foreground">
            保存済みビューで個別に切替可能
          </span>
        </span>
        <Switch
          aria-label={`${layer.name}をタイムラインに表示`}
          checked={layer.isVisible}
          onCheckedChange={(checked) => update.mutate({ isVisible: checked })}
        />
      </label>
      {layer.periods.map((period) =>
        editingPeriod === period.id ? (
          <PeriodForm
            key={period.id}
            layerId={layer.id}
            period={period}
            projectId={projectId}
            onDone={() => setEditingPeriod(null)}
          />
        ) : (
          <div
            key={period.id}
            className="flex items-center gap-2 rounded-md border px-3 py-2"
          >
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: period.color }}
            />
            <button
              className="min-w-0 flex-1 text-left text-sm font-medium hover:underline"
              type="button"
              onClick={() => setEditingPeriod(period.id)}
            >
              {period.title}
            </button>
            {overlaps.has(period.id) ? (
              <span className="flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="size-4" />
                期間重複
              </span>
            ) : null}
            <Button
              aria-label={`${period.title}を削除`}
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`「${period.title}」を削除しますか？`))
                  removePeriod.mutate(period.id);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      )}
      {editingPeriod === "new" ? (
        <PeriodForm
          layerId={layer.id}
          projectId={projectId}
          onDone={() => setEditingPeriod(null)}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditingPeriod("new")}
        >
          <Plus />
          背景期間を追加
        </Button>
      )}
    </section>
  );
}

export function BackgroundLayerManager({
  projectId,
  initialLayers,
}: {
  projectId: string;
  initialLayers: TimelineBackgroundLayer[];
}) {
  const queryClient = useQueryClient();
  const { data: layers = initialLayers } = useQuery({
    queryKey: backgroundLayerKeys.list(projectId),
    queryFn: () => listBackgroundLayers(projectId),
    initialData: initialLayers,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: standardSchemaResolver(createBackgroundLayerSchema),
    defaultValues: { name: "", description: "", isVisible: true },
  });
  const create = useMutation({
    mutationFn: (input: {
      name: string;
      description: string | null;
      isVisible: boolean;
    }) => createBackgroundLayer(projectId, input),
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({
        queryKey: backgroundLayerKeys.list(projectId),
      });
    },
  });
  return (
    <div className="space-y-4">
      <form
        className="space-y-2 rounded-lg border border-dashed p-4"
        onSubmit={handleSubmit((values) => create.mutate(values))}
      >
        <h2 className="font-medium">新しい背景レイヤー</h2>
        <Input
          aria-label="新しいレイヤー名"
          placeholder="時代区分、王朝、文化潮流など"
          {...register("name")}
        />
        <Textarea
          aria-label="新しいレイヤーの説明"
          placeholder="説明（任意）"
          {...register("description")}
        />
        {errors.name ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        ) : null}
        <Button disabled={create.isPending} type="submit">
          <Plus />
          レイヤーを追加
        </Button>
      </form>
      {layers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          背景レイヤーはまだありません。
        </p>
      ) : (
        layers.map((layer, index) => (
          <LayerCard
            key={layer.id}
            count={layers.length}
            index={index}
            layer={layer}
            projectId={projectId}
          />
        ))
      )}
    </div>
  );
}
