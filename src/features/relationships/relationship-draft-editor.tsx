"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listRelationships,
  relationshipKeys,
} from "@/features/relationships/api";
import {
  DEFAULT_RELATIONSHIP_TYPES,
  type RelationshipDraft,
  type RelationshipEntityType,
} from "@/features/relationships/types";

const EMPTY_DRAFT: RelationshipDraft = {
  targetType: "timeline_item",
  targetId: "",
  relationType: "影響",
  lineStyle: "single",
  sourceMarker: "none",
  targetMarker: "arrow",
  note: null,
};

export function RelationshipDraftEditor({
  projectId,
  sourceType,
  value,
  onChange,
}: {
  projectId: string;
  sourceType: RelationshipEntityType;
  value: RelationshipDraft[];
  onChange: (value: RelationshipDraft[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: relationshipKeys.all(projectId),
    queryFn: () => listRelationships(projectId),
  });
  const entities = useMemo(() => data?.entities ?? [], [data?.entities]);
  const labels = useMemo(
    () =>
      new Map(
        entities.map((entity) => [`${entity.type}:${entity.id}`, entity.title]),
      ),
    [entities],
  );
  const relationshipTypes = useMemo(
    () => [
      ...new Set([
        ...DEFAULT_RELATIONSHIP_TYPES,
        ...(data?.relationships.map(
          (relationship) => relationship.relationType,
        ) ?? []),
      ]),
    ],
    [data?.relationships],
  );
  const targetOptions = entities.filter(
    (entity) => entity.type === draft.targetType,
  );

  function addDraft() {
    if (!draft.targetId || !draft.relationType.trim()) {
      setError("関係先と関係種別を指定してください。");
      return;
    }
    onChange([...value, { ...draft, relationType: draft.relationType.trim() }]);
    setDraft({ ...EMPTY_DRAFT, targetType: draft.targetType });
    setError(null);
  }

  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      data-testid="relationship-draft-editor"
    >
      <div>
        <h2 className="font-medium">同時に追加する関係性</h2>
        <p className="text-sm text-muted-foreground">
          作成する{sourceType === "timeline_item" ? "タイムライン" : "イベント"}
          を始点として登録します。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-target-type`}>関係先の種類</Label>
          <select
            id={`${id}-target-type`}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={draft.targetType}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                targetType: event.target.value as RelationshipEntityType,
                targetId: "",
              }))
            }
          >
            <option value="timeline_item">タイムラインアイテム</option>
            <option value="timeline_event">イベントアイテム</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-target`}>関係先</Label>
          <select
            id={`${id}-target`}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={draft.targetId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                targetId: event.target.value,
              }))
            }
          >
            <option value="">選択してください</option>
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-type`}>関係種別</Label>
          <Input
            id={`${id}-type`}
            list={`${id}-type-options`}
            value={draft.relationType}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                relationType: event.target.value,
              }))
            }
          />
          <datalist id={`${id}-type-options`}>
            {relationshipTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-line`}>線</Label>
          <select
            id={`${id}-line`}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={draft.lineStyle}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                lineStyle: event.target.value as RelationshipDraft["lineStyle"],
              }))
            }
          >
            <option value="single">直線</option>
            <option value="double">二重線</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={draft.sourceMarker === "arrow"}
            type="checkbox"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sourceMarker: event.target.checked ? "arrow" : "none",
              }))
            }
          />
          始点に矢印
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={draft.targetMarker === "arrow"}
            type="checkbox"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                targetMarker: event.target.checked ? "arrow" : "none",
              }))
            }
          />
          終点に矢印
        </label>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={addDraft}>
        <Plus aria-hidden="true" className="size-4" />
        関係性を追加
      </Button>
      {value.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {value.map((relationship, index) => (
            <li
              key={`${relationship.targetType}:${relationship.targetId}:${index}`}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1">
                <strong>{relationship.relationType}</strong>{" "}
                {relationship.targetMarker === "arrow"
                  ? "⇒"
                  : relationship.lineStyle === "double"
                    ? "＝"
                    : "—"}{" "}
                {labels.get(
                  `${relationship.targetType}:${relationship.targetId}`,
                ) ?? "削除済みの項目"}
              </span>
              <Button
                aria-label={`${relationship.relationType}の関係性を削除`}
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() =>
                  onChange(value.filter((_, candidate) => candidate !== index))
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
