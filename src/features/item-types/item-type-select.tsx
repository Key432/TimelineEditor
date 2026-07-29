"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createItemType,
  deleteItemType,
  itemTypeKeys,
  listItemTypes,
  updateItemType,
} from "@/features/item-types/api";
import { invalidateItemTypeDependents } from "@/features/item-types/cache";
import {
  ItemTypeIcon,
  ItemTypeIconPicker,
} from "@/features/item-types/item-type-icon";
import type { TimelineItemType } from "@/features/item-types/types";
import type { UpdateItemTypeInput } from "@/features/item-types/validation";
import { useClickOutside } from "@/hooks/use-click-outside";

const TYPE_COLORS = [
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

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ja");
}

export function TimelineItemTypeSelect({
  projectId,
  initialItemTypes,
  value,
  onChange,
}: {
  projectId: string;
  initialItemTypes: TimelineItemType[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<TimelineItemType | null>(null);
  useClickOutside(containerRef, () => {
    setOpen(false);
    setEditing(null);
  });
  const { data: itemTypes = initialItemTypes } = useQuery({
    queryKey: itemTypeKeys.list(projectId),
    queryFn: () => listItemTypes(projectId),
    initialData: initialItemTypes,
  });
  const refresh = () => invalidateItemTypeDependents(queryClient, projectId);
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createItemType(projectId, {
        name,
        defaultColor: "#00B0B0",
        icon: "circle-dot",
      }),
    onSuccess: async (itemType) => {
      await refresh();
      onChange(itemType.id);
      setDraft("");
    },
  });
  const selected = itemTypes.find((itemType) => itemType.id === value);
  const filtered = itemTypes.filter((itemType) =>
    normalizeName(itemType.name).includes(normalizeName(draft)),
  );
  const canCreate =
    normalizeName(draft).length > 0 &&
    !itemTypes.some(
      (itemType) => normalizeName(itemType.name) === normalizeName(draft),
    );

  return (
    <div ref={containerRef} className="space-y-2">
      <Label>タイムライン種別</Label>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap gap-1.5 rounded-md border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
          {selected ? (
            <span className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs">
              <ItemTypeIcon
                color={selected.defaultColor}
                icon={selected.icon}
              />
              <span>{selected.name}</span>
            </span>
          ) : null}
          <input
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-label="タイムライン種別を検索または作成"
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
            {filtered.map((itemType) => (
              <div
                key={itemType.id}
                className="flex items-center rounded hover:bg-muted"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"
                  type="button"
                  onClick={() => {
                    onChange(itemType.id);
                    setDraft("");
                    setOpen(false);
                  }}
                >
                  <ItemTypeIcon
                    color={itemType.defaultColor}
                    icon={itemType.icon}
                  />
                  <span className="truncate">{itemType.name}</span>
                  {!itemType.isVisible ? (
                    <EyeOff aria-label="非表示" className="ml-auto size-4" />
                  ) : value === itemType.id ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                </button>
                <button
                  aria-label={`${itemType.name}の設定変更`}
                  className="mr-1 rounded p-1 opacity-70 hover:bg-background"
                  type="button"
                  onClick={() => {
                    setEditing(itemType);
                  }}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            ))}
            {canCreate ? (
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"
                type="button"
                onClick={() => createMutation.mutate(draft.trim())}
              >
                <Plus className="size-4" />「{draft.trim()}」を作成
              </button>
            ) : null}
          </div>
        ) : null}
        {editing ? (
          <TimelineItemTypeSettings
            index={itemTypes.findIndex(
              (itemType) => itemType.id === editing.id,
            )}
            itemType={
              itemTypes.find((itemType) => itemType.id === editing.id) ??
              editing
            }
            projectId={projectId}
            total={itemTypes.length}
            onClose={() => {
              setEditing(null);
              void refresh();
            }}
            onSaved={refresh}
          />
        ) : null}
      </div>
    </div>
  );
}

function TimelineItemTypeSettings({
  projectId,
  itemType,
  index,
  total,
  onClose,
  onSaved,
}: {
  projectId: string;
  itemType: TimelineItemType;
  index: number;
  total: number;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(itemType.name);
  const [color, setColor] = useState(itemType.defaultColor);
  const [icon, setIcon] = useState(itemType.icon ?? "circle-dot");
  const persist = useMutation({
    scope: { id: `item-type-settings-${itemType.id}` },
    mutationFn: (values: UpdateItemTypeInput) =>
      updateItemType(projectId, itemType.id, values),
    onMutate: (values) => {
      queryClient.setQueryData<TimelineItemType[]>(
        itemTypeKeys.list(projectId),
        (current) =>
          current?.map((candidate) =>
            candidate.id === itemType.id
              ? { ...candidate, ...values }
              : candidate,
          ),
      );
    },
    onSuccess: onSaved,
    onError: onSaved,
  });
  const changeOrder = useMutation({
    mutationFn: (sortOrder: number) =>
      updateItemType(projectId, itemType.id, { sortOrder }),
    onSuccess: onSaved,
  });
  const remove = useMutation({
    mutationFn: () => deleteItemType(projectId, itemType.id),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const error = persist.error ?? changeOrder.error ?? remove.error;
  return (
    <div className="absolute right-0 z-[60] mt-1 w-80 space-y-3 rounded-xl border bg-popover p-3 shadow-2xl">
      <Input
        aria-label="タイムライン種別名"
        value={name}
        onChange={(event) => {
          const nextName = event.target.value;
          setName(nextName);
          if (nextName.trim()) persist.mutate({ name: nextName });
        }}
      />
      <ItemTypeIconPicker
        color={color}
        value={icon}
        onChange={(nextIcon) => {
          setIcon(nextIcon);
          persist.mutate({ icon: nextIcon });
        }}
      />
      <fieldset>
        <legend className="mb-2 text-xs text-muted-foreground">カラー</legend>
        <div className="grid grid-cols-11 gap-1">
          {TYPE_COLORS.map((candidate) => (
            <button
              key={candidate}
              aria-label={`色 ${candidate}`}
              aria-pressed={color === candidate}
              className="size-5 rounded border aria-pressed:ring-2 aria-pressed:ring-primary"
              style={{ backgroundColor: candidate }}
              type="button"
              onClick={() => {
                setColor(candidate);
                persist.mutate({ defaultColor: candidate });
              }}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          aria-label="上へ移動"
          disabled={index <= 0 || changeOrder.isPending}
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => changeOrder.mutate(index - 1)}
        >
          <ArrowUp />
        </Button>
        <Button
          aria-label="下へ移動"
          disabled={index < 0 || index >= total - 1 || changeOrder.isPending}
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => changeOrder.mutate(index + 1)}
        >
          <ArrowDown />
        </Button>
        <Button
          aria-label={itemType.isVisible ? "非表示にする" : "表示する"}
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => persist.mutate({ isVisible: !itemType.isVisible })}
        >
          {itemType.isVisible ? <Eye /> : <EyeOff />}
        </Button>
        <Button
          aria-label="タイムライン種別を削除"
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => {
            if (window.confirm(`「${itemType.name}」を削除しますか？`))
              remove.mutate();
          }}
        >
          <Trash2 />
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onClose}>
          閉じる
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
