"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomField,
  deleteCustomField,
  mergeTag,
  classificationKeys,
} from "@/features/classification/api";
import {
  EventTypeSelect,
  useClassification,
} from "@/features/classification/entity-classification-fields";
import {
  CUSTOM_FIELD_TYPES,
  type CustomFieldEntityType,
  type CustomFieldType,
} from "@/features/classification/types";
import type { TimelineItemType } from "@/features/item-types/types";

const FIELD_LABELS: Record<CustomFieldType, string> = {
  text: "文字列",
  multiline: "複数行",
  number: "数値",
  boolean: "真偽値",
  single_select: "単一選択",
  multi_select: "複数選択",
  url: "URL",
  historical_date: "歴史日付",
  entity_reference: "他アイテム参照",
};

export function ClassificationManager({
  projectId,
  itemTypes,
}: {
  projectId: string;
  itemTypes: TimelineItemType[];
}) {
  const query = useClassification(projectId);
  const client = useQueryClient();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [entityType, setEntityType] =
    useState<CustomFieldEntityType>("timeline_item");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [required, setRequired] = useState(false);
  const [scope, setScope] = useState<"project" | "type">("project");
  const [targetTypeId, setTargetTypeId] = useState<string | null>(null);
  const [options, setOptions] = useState("");
  const refresh = () =>
    client.invalidateQueries({ queryKey: classificationKeys.all(projectId) });
  const merge = useMutation({
    mutationFn: () => mergeTag(projectId, source, target),
    onSuccess: async () => {
      await refresh();
      setSource("");
      setTarget("");
    },
  });
  const createField = useMutation({
    mutationFn: () =>
      createCustomField(projectId, {
        entityType,
        scope,
        targetTypeId: scope === "type" ? targetTypeId : null,
        name,
        fieldType,
        isRequired: required,
        options: options
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        description: null,
      }),
    onSuccess: async () => {
      await refresh();
      setName("");
      setOptions("");
    },
  });
  const removeField = useMutation({
    mutationFn: (id: string) => deleteCustomField(projectId, id),
    onSuccess: refresh,
  });
  const data = query.data;
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-medium">タグの統合</h2>
        <p className="text-sm text-muted-foreground">
          元タグの関連を統合先へ移し、元タグを削除します。
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
          <select
            aria-label="統合元タグ"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="">統合元</option>
            {data?.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}（{tag.usageCount}）
              </option>
            ))}
          </select>
          <span className="self-center">→</span>
          <select
            aria-label="統合先タグ"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">統合先</option>
            {data?.tags
              .filter((tag) => tag.id !== source)
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
          </select>
          <Button
            disabled={!source || !target || merge.isPending}
            type="button"
            onClick={() => merge.mutate()}
          >
            統合
          </Button>
        </div>
      </section>
      <section className="space-y-3 border-t pt-6">
        <h2 className="font-medium">イベント種別</h2>
        <p className="text-sm text-muted-foreground">
          候補の「…」から名前、説明、色、マーカー形状を変更できます。
        </p>
        <EventTypeSelect
          projectId={projectId}
          value={null}
          onChange={() => undefined}
        />
      </section>
      <section className="space-y-4 border-t pt-6">
        <h2 className="font-medium">カスタムフィールド</h2>
        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="custom-field-name">名前</Label>
            <Input
              id="custom-field-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-field-entity">対象</Label>
            <select
              id="custom-field-entity"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value as CustomFieldEntityType);
                setTargetTypeId(null);
              }}
            >
              <option value="timeline_item">タイムラインアイテム</option>
              <option value="timeline_event">イベントアイテム</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-field-type">型</Label>
            <select
              id="custom-field-type"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={fieldType}
              onChange={(event) =>
                setFieldType(event.target.value as CustomFieldType)
              }
            >
              {CUSTOM_FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FIELD_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-field-scope">適用範囲</Label>
            <select
              id="custom-field-scope"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as "project" | "type");
                setTargetTypeId(null);
              }}
            >
              <option value="project">プロジェクト共通</option>
              <option value="type">対象種別ごと</option>
            </select>
          </div>
          {scope === "type" ? (
            <div className="space-y-1">
              <Label htmlFor="custom-field-target">対象種別</Label>
              <select
                id="custom-field-target"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={targetTypeId ?? ""}
                onChange={(event) =>
                  setTargetTypeId(event.target.value || null)
                }
              >
                <option value="">選択してください</option>
                {(entityType === "timeline_item"
                  ? itemTypes
                  : (data?.eventTypes ?? [])
                ).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {["single_select", "multi_select"].includes(fieldType) ? (
            <div className="space-y-1">
              <Label htmlFor="custom-field-options">
                選択肢（カンマ区切り）
              </Label>
              <Input
                id="custom-field-options"
                value={options}
                onChange={(event) => setOptions(event.target.value)}
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={required}
              type="checkbox"
              onChange={(event) => setRequired(event.target.checked)}
            />
            必須
          </label>
          <Button
            disabled={
              !name.trim() ||
              createField.isPending ||
              (scope === "type" && !targetTypeId)
            }
            type="button"
            onClick={() => createField.mutate()}
          >
            追加
          </Button>
        </div>
        <ul className="divide-y rounded-lg border">
          {data?.customFields.map((field) => (
            <li
              key={field.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{field.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {field.entityType === "timeline_item"
                    ? "アイテム"
                    : "イベント"}
                  ・{FIELD_LABELS[field.fieldType]}
                  {field.isRequired ? "・必須" : ""}
                </span>
              </span>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => removeField.mutate(field.id)}
              >
                削除
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
