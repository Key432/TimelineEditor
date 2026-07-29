"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MoreHorizontal, Plus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ClassificationData,
  classificationKeys,
  createEventType,
  createTag,
  deleteEventType,
  deleteTag,
  listClassification,
  updateEventType,
  updateTag,
} from "@/features/classification/api";
import { MarkerShapeIcon } from "@/features/classification/marker-shape";
import {
  MARKER_SHAPES,
  type CustomFieldEntry,
  type CustomFieldEntityType,
  type EventType,
  type MarkerShape,
  type Tag,
} from "@/features/classification/types";
import type { EventTypeInput } from "@/features/classification/validation";
import { getInternalLinkCandidates } from "@/features/internal-links/api";
import type { HistoricalDate } from "@/features/timeline-items/types";
import { useClickOutside } from "@/hooks/use-click-outside";

const PALETTE = [
  "#E5E7EB",
  "#D6D3D1",
  "#FED7AA",
  "#FDE68A",
  "#BBF7D0",
  "#BAE6FD",
  "#DDD6FE",
  "#FBCFE8",
  "#FECACA",
  "#00B0B0",
  "#FF3399",
];

function isHistoricalDateValue(
  value: CustomFieldEntry["value"] | undefined,
): value is HistoricalDate {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "year" in value
  );
}

export function useClassification(projectId: string) {
  return useQuery({
    queryKey: classificationKeys.all(projectId),
    queryFn: () => listClassification(projectId),
    enabled: Boolean(projectId),
  });
}

export function TagMultiSelect({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const query = useClassification(projectId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => {
    setOpen(false);
    setEditing(null);
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: classificationKeys.all(projectId),
    });
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createTag(projectId, { name, color: "#E5E7EB", description: null }),
    onSuccess: async (tag) => {
      await refresh();
      onChange([...value, tag.id]);
      setDraft("");
    },
  });
  const tags = query.data?.tags ?? [];
  const selected = tags.filter((tag) => value.includes(tag.id));
  const filtered = tags.filter((tag) =>
    tag.name
      .toLocaleLowerCase("ja")
      .includes(draft.trim().toLocaleLowerCase("ja")),
  );
  return (
    <div ref={containerRef} className="space-y-2">
      <Label>タグ</Label>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap gap-1.5 rounded-md border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs"
              style={{ backgroundColor: tag.color }}
            >
              <span>{tag.name}</span>
              <button
                aria-label={`${tag.name}を外す`}
                type="button"
                onClick={() => onChange(value.filter((id) => id !== tag.id))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            aria-label="タグを検索または作成"
            className="min-w-36 flex-1 bg-transparent px-1 text-sm outline-none"
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                return;
              }
              if (
                event.key === "Enter" &&
                draft.trim() &&
                !tags.some(
                  (tag) =>
                    tag.name.localeCompare(draft.trim(), "ja", {
                      sensitivity: "base",
                    }) === 0,
                )
              ) {
                event.preventDefault();
                createMutation.mutate(draft.trim());
              }
            }}
          />
        </div>
        {open ? (
          <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl">
            <p className="px-2 py-1 text-xs text-muted-foreground">
              オプションを選択するか作成します
            </p>
            {filtered.map((tag) => (
              <div
                key={tag.id}
                className="group flex items-center rounded-md hover:bg-muted"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"
                  type="button"
                  onClick={() =>
                    onChange(
                      value.includes(tag.id)
                        ? value.filter((id) => id !== tag.id)
                        : [...value, tag.id],
                    )
                  }
                >
                  <span
                    className="size-3 rounded-sm"
                    style={{ backgroundColor: tag.color }}
                  />{" "}
                  <span className="truncate">{tag.name}</span>
                  {value.includes(tag.id) ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                </button>
                <button
                  aria-label={`${tag.name}の設定変更`}
                  className="mr-1 rounded p-1 opacity-70 hover:bg-background"
                  type="button"
                  onClick={() => setEditing(tag)}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            ))}
            {draft.trim() && filtered.length === 0 ? (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                type="button"
                onClick={() => createMutation.mutate(draft.trim())}
              >
                <Plus className="size-4" />「{draft.trim()}」を作成
              </button>
            ) : null}
          </div>
        ) : null}
        {editing ? (
          <TagSettings
            tag={editing}
            onClose={() => {
              setEditing(null);
              void refresh();
            }}
            onSaved={refresh}
            projectId={projectId}
          />
        ) : null}
      </div>
    </div>
  );
}

function TagSettings({
  projectId,
  tag,
  onClose,
  onSaved,
}: {
  projectId: string;
  tag: Tag;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [description, setDescription] = useState(tag.description ?? "");
  const save = useMutation({
    mutationFn: () =>
      updateTag(projectId, tag.id, { name, color, description }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteTag(projectId, tag.id, true),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  return (
    <div className="absolute right-0 z-[60] mt-1 w-72 space-y-3 rounded-xl border bg-popover p-3 shadow-2xl">
      <Input
        aria-label="タグ名"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Textarea
        aria-label="タグの説明"
        placeholder="説明（任意）"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <ColorPalette value={color} onChange={setColor} />
      <div className="flex gap-2">
        <Button size="sm" type="button" onClick={() => save.mutate()}>
          保存
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={tag.usageCount > 0}
          onClick={() => remove.mutate()}
        >
          未使用タグを削除
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onClose}>
          閉じる
        </Button>
      </div>
      {tag.usageCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {tag.usageCount}件で使用中です。統合は分類管理から行えます。
        </p>
      ) : null}
    </div>
  );
}

export function EventTypeSelect({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const query = useClassification(projectId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<EventType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  useClickOutside(containerRef, () => {
    setOpen(false);
    setEditing(null);
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: classificationKeys.all(projectId),
    });
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createEventType(projectId, {
        name,
        color: "#FF3399",
        markerShape: "circle",
        description: null,
      }),
    onSuccess: async (type) => {
      await refresh();
      onChange(type.id);
      setDraft("");
    },
  });
  const types = query.data?.eventTypes ?? [];
  const selected = types.find((type) => type.id === value);
  const filtered = types.filter((type) =>
    type.name
      .toLocaleLowerCase("ja")
      .includes(draft.trim().toLocaleLowerCase("ja")),
  );
  const canCreate =
    draft.trim().length > 0 &&
    !types.some(
      (type) =>
        type.name.localeCompare(draft.trim(), "ja", {
          sensitivity: "base",
        }) === 0,
    );
  return (
    <div ref={containerRef} className="space-y-2">
      <Label>イベント種別</Label>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap gap-1.5 rounded-md border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
          {selected ? (
            <span className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs">
              <MarkerShapeIcon
                color={selected.color}
                shape={selected.markerShape}
              />
              <span>{selected.name}</span>
              <button
                aria-label={`${selected.name}を外す`}
                type="button"
                onClick={() => onChange(null)}
              >
                <X className="size-3" />
              </button>
            </span>
          ) : null}
          <input
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-label="イベント種別を検索または作成"
            className="min-w-36 flex-1 bg-transparent px-1 text-sm outline-none"
            placeholder={selected ? "別の種別を検索" : "検索または新規作成"}
            role="combobox"
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                return;
              }
              if (event.key === "Enter" && canCreate) {
                event.preventDefault();
                createMutation.mutate(draft.trim());
              }
            }}
          />
        </div>
        {open ? (
          <div
            id={listboxId}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl"
          >
            <p className="px-2 py-1 text-xs text-muted-foreground">
              オプションを選択するか作成します
            </p>
            <button
              className="flex w-full items-center rounded px-2 py-2 text-sm hover:bg-muted"
              type="button"
              onClick={() => {
                onChange(null);
                setDraft("");
                setOpen(false);
              }}
            >
              種別なし
            </button>
            {filtered.map((type) => (
              <div
                key={type.id}
                className="flex items-center rounded hover:bg-muted"
              >
                <button
                  className="flex flex-1 items-center gap-2 px-2 py-2 text-sm"
                  type="button"
                  onClick={() => {
                    onChange(type.id);
                    setDraft("");
                    setOpen(false);
                  }}
                >
                  <MarkerShapeIcon
                    color={type.color}
                    shape={type.markerShape}
                  />
                  {type.name}
                  {value === type.id ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                </button>
                <button
                  aria-label={`${type.name}の設定変更`}
                  className="mr-1 p-1"
                  type="button"
                  onClick={() => {
                    setEditing(type);
                  }}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            ))}
            {canCreate ? (
              <button
                className="flex w-full items-center gap-2 px-2 py-2 text-sm hover:bg-muted"
                type="button"
                onClick={() => createMutation.mutate(draft.trim())}
              >
                <Plus className="size-4" />「{draft.trim()}」を作成
              </button>
            ) : null}
          </div>
        ) : null}
        {editing ? (
          <EventTypeSettings
            type={types.find((type) => type.id === editing.id) ?? editing}
            projectId={projectId}
            onClose={() => setEditing(null)}
            onSaved={refresh}
          />
        ) : null}
      </div>
    </div>
  );
}

function EventTypeSettings({
  type,
  projectId,
  onClose,
  onSaved,
}: {
  type: EventType;
  projectId: string;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState(type.color);
  const [shape, setShape] = useState<MarkerShape>(type.markerShape);
  const [description, setDescription] = useState(type.description ?? "");
  const persist = useMutation({
    scope: { id: `event-type-settings-${type.id}` },
    mutationFn: (values: EventTypeInput) =>
      updateEventType(projectId, type.id, values),
    onMutate: (values) => {
      queryClient.setQueryData<ClassificationData>(
        classificationKeys.all(projectId),
        (current) =>
          current
            ? {
                ...current,
                eventTypes: current.eventTypes.map((candidate) =>
                  candidate.id === type.id
                    ? { ...candidate, ...values }
                    : candidate,
                ),
              }
            : current,
      );
    },
    onError: onSaved,
  });
  const remove = useMutation({
    mutationFn: () => deleteEventType(projectId, type.id),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  return (
    <div className="absolute right-0 z-[60] mt-1 w-80 space-y-3 rounded-xl border bg-popover p-3 shadow-2xl">
      <Input
        aria-label="イベント種別名"
        value={name}
        onChange={(event) => {
          const nextName = event.target.value;
          setName(nextName);
          if (nextName.trim()) {
            persist.mutate({
              name: nextName,
              color,
              markerShape: shape,
              description,
            });
          }
        }}
      />
      <Textarea
        aria-label="イベント種別の説明"
        value={description}
        onChange={(event) => {
          const nextDescription = event.target.value;
          setDescription(nextDescription);
          persist.mutate({
            name,
            color,
            markerShape: shape,
            description: nextDescription,
          });
        }}
      />
      <fieldset>
        <legend className="mb-2 text-xs text-muted-foreground">
          マーカー形状
        </legend>
        <div className="grid grid-cols-6 gap-2">
          {MARKER_SHAPES.map((candidate) => (
            <button
              key={candidate}
              aria-label={`${candidate}形状`}
              aria-pressed={shape === candidate}
              className="flex h-9 items-center justify-center rounded border aria-pressed:ring-2 aria-pressed:ring-primary"
              type="button"
              onClick={() => {
                setShape(candidate);
                persist.mutate({
                  name,
                  color,
                  markerShape: candidate,
                  description,
                });
              }}
            >
              <MarkerShapeIcon
                className="size-5"
                color={color}
                shape={candidate}
              />
            </button>
          ))}
        </div>
      </fieldset>
      <ColorPalette
        value={color}
        onChange={(nextColor) => {
          setColor(nextColor);
          persist.mutate({
            name,
            color: nextColor,
            markerShape: shape,
            description,
          });
        }}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={type.usageCount > 0}
          onClick={() => remove.mutate()}
        >
          削除
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onClose}>
          閉じる
        </Button>
      </div>
      {persist.error ? (
        <p role="alert" className="text-sm text-destructive">
          {persist.error.message}
        </p>
      ) : null}
    </div>
  );
}

function ColorPalette({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-muted-foreground">カラー</legend>
      <div className="grid grid-cols-11 gap-1">
        {PALETTE.map((color) => (
          <button
            key={color}
            aria-label={`色 ${color}`}
            aria-pressed={value === color}
            className="size-5 rounded border aria-pressed:ring-2 aria-pressed:ring-primary"
            style={{ backgroundColor: color }}
            type="button"
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function EntityReferenceField({
  projectId,
  fieldName,
  value,
  onChange,
}: {
  projectId: string;
  fieldName: string;
  value: CustomFieldEntry["value"] | undefined;
  onChange: (value: CustomFieldEntry["value"] | null) => void;
}) {
  const [query, setQuery] = useState("");
  const reference = value as
    { entityType?: CustomFieldEntityType; entityId?: string } | undefined;
  const candidates = useQuery({
    queryKey: ["internal-link-candidates", projectId, query],
    queryFn: () => getInternalLinkCandidates(projectId, query),
  });
  return (
    <div className="space-y-2">
      <Input
        aria-label={`${fieldName}の参照先を検索`}
        placeholder="タイトルまたは別名で検索"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        aria-label={`${fieldName}の参照先`}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        value={reference?.entityId ?? ""}
        onChange={(event) => {
          const selected = candidates.data?.find(
            (candidate) => candidate.entityId === event.target.value,
          );
          onChange(
            selected
              ? {
                  entityType:
                    selected.entityType === "item"
                      ? "timeline_item"
                      : "timeline_event",
                  entityId: selected.entityId,
                }
              : null,
          );
        }}
      >
        <option value="">参照先なし</option>
        {candidates.data?.map((candidate) => (
          <option
            key={`${candidate.entityType}:${candidate.entityId}`}
            value={candidate.entityId}
          >
            {candidate.title}（{candidate.kindLabel}）
          </option>
        ))}
        {reference?.entityId &&
        !candidates.data?.some(
          (candidate) => candidate.entityId === reference.entityId,
        ) ? (
          <option value={reference.entityId}>現在の参照先</option>
        ) : null}
      </select>
    </div>
  );
}

export function CustomFieldsEditor({
  projectId,
  entityType,
  targetTypeId,
  value,
  onChange,
}: {
  projectId: string;
  entityType: CustomFieldEntityType;
  targetTypeId: string | null;
  value: CustomFieldEntry[];
  onChange: (value: CustomFieldEntry[]) => void;
}) {
  const query = useClassification(projectId);
  const definitions = useMemo(
    () =>
      (query.data?.customFields ?? []).filter(
        (field) =>
          field.entityType === entityType &&
          (field.scope === "project" || field.targetTypeId === targetTypeId),
      ),
    [entityType, query.data?.customFields, targetTypeId],
  );
  useEffect(() => {
    if (!query.data) return;
    const allowed = new Set(definitions.map((field) => field.id));
    const next = value.filter((entry) => allowed.has(entry.fieldId));
    if (next.length !== value.length) onChange(next);
  }, [definitions, onChange, query.data, value]);
  if (definitions.length === 0) return null;
  const get = (id: string) =>
    value.find((entry) => entry.fieldId === id)?.value;
  const set = (fieldId: string, next: CustomFieldEntry["value"] | null) =>
    onChange(
      next === null || next === "" || (Array.isArray(next) && next.length === 0)
        ? value.filter((entry) => entry.fieldId !== fieldId)
        : [
            ...value.filter((entry) => entry.fieldId !== fieldId),
            { fieldId, value: next },
          ],
    );
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <h2 className="text-sm font-medium">カスタムフィールド</h2>
      {definitions.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label>
            {field.name}
            {field.isRequired ? " *" : ""}
          </Label>
          {field.fieldType === "boolean" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={get(field.id) === true}
                type="checkbox"
                onChange={(event) => set(field.id, event.target.checked)}
              />
              有効
            </label>
          ) : field.fieldType === "multiline" ? (
            <Textarea
              value={String(get(field.id) ?? "")}
              onChange={(event) => set(field.id, event.target.value)}
            />
          ) : field.fieldType === "single_select" ? (
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={String(get(field.id) ?? "")}
              onChange={(event) => set(field.id, event.target.value)}
            >
              <option value="">選択してください</option>
              {field.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : field.fieldType === "multi_select" ? (
            <div className="flex flex-wrap gap-2">
              {field.options.map((option) => (
                <label key={option} className="flex items-center gap-1 text-sm">
                  <input
                    checked={
                      Array.isArray(get(field.id)) &&
                      (get(field.id) as string[]).includes(option)
                    }
                    type="checkbox"
                    onChange={(event) => {
                      const current = Array.isArray(get(field.id))
                        ? (get(field.id) as string[])
                        : [];
                      set(
                        field.id,
                        event.target.checked
                          ? [...current, option]
                          : current.filter((item) => item !== option),
                      );
                    }}
                  />
                  {option}
                </label>
              ))}
            </div>
          ) : field.fieldType === "historical_date" ? (
            <Input
              aria-label={`${field.name}の年`}
              min={1}
              placeholder="年"
              type="number"
              value={
                isHistoricalDateValue(get(field.id))
                  ? String((get(field.id) as { year: number }).year)
                  : ""
              }
              onChange={(event) =>
                set(
                  field.id,
                  event.target.value
                    ? {
                        era: "ce",
                        precision: "year",
                        year: Number(event.target.value),
                        month: null,
                        day: null,
                        originalText: null,
                        calendar: "proleptic_gregorian",
                      }
                    : null,
                )
              }
            />
          ) : field.fieldType === "entity_reference" ? (
            <EntityReferenceField
              fieldName={field.name}
              projectId={projectId}
              value={get(field.id)}
              onChange={(next) => set(field.id, next)}
            />
          ) : (
            <Input
              type={
                field.fieldType === "number"
                  ? "number"
                  : field.fieldType === "url"
                    ? "url"
                    : "text"
              }
              value={String(get(field.id) ?? "")}
              onChange={(event) =>
                set(
                  field.id,
                  field.fieldType === "number"
                    ? event.target.value
                      ? Number(event.target.value)
                      : null
                    : event.target.value,
                )
              }
            />
          )}
          {field.description ? (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
