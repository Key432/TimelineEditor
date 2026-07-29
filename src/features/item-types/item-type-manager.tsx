"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createItemType,
  itemTypeKeys,
  listItemTypes,
  updateItemType,
} from "@/features/item-types/api";
import { DeleteItemTypeDialog } from "@/features/item-types/delete-item-type-dialog";
import { ItemTypeIconPicker } from "@/features/item-types/item-type-icon";
import type { TimelineItemType } from "@/features/item-types/types";

type ItemTypeManagerProps = {
  projectId: string;
  initialItemTypes: TimelineItemType[];
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ja");
}

function ItemTypeRow({
  itemType,
  index,
  total,
  projectId,
}: {
  itemType: TimelineItemType;
  index: number;
  total: number;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(itemType.name);
  const [defaultColor, setDefaultColor] = useState(itemType.defaultColor);
  const [icon, setIcon] = useState(itemType.icon ?? "");
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateItemType>[2]) =>
      updateItemType(projectId, itemType.id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: itemTypeKeys.list(projectId) }),
  });
  const changed =
    name !== itemType.name ||
    defaultColor.toUpperCase() !== itemType.defaultColor.toUpperCase() ||
    icon !== (itemType.icon ?? "");

  return (
    <li
      className="grid gap-4 border-b px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(12rem,1fr)_10rem_11rem_auto]"
      data-testid={`item-type-row-${itemType.id}`}
    >
      <div className="space-y-2">
        <Label htmlFor={`item-type-name-${itemType.id}`}>名称</Label>
        <Input
          id={`item-type-name-${itemType.id}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`item-type-color-${itemType.id}`}>既定色</Label>
        <div className="flex gap-2">
          <input
            aria-label={`${itemType.name}のカラーピッカー`}
            className="h-9 w-11 cursor-pointer rounded-md border bg-background p-1"
            type="color"
            value={defaultColor}
            onChange={(event) => setDefaultColor(event.target.value)}
          />
          <Input
            id={`item-type-color-${itemType.id}`}
            aria-label={`${itemType.name}の色コード`}
            className="font-mono uppercase"
            maxLength={7}
            value={defaultColor}
            onChange={(event) => setDefaultColor(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <ItemTypeIconPicker
          color={defaultColor}
          value={icon}
          onChange={setIcon}
        />
      </div>
      <div className="flex items-end justify-between gap-2 lg:justify-end">
        <div className="flex items-center gap-1">
          <Button
            aria-label={`${itemType.name}を上へ移動`}
            disabled={index === 0 || mutation.isPending}
            size="icon"
            variant="outline"
            onClick={() => mutation.mutate({ sortOrder: index - 1 })}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label={`${itemType.name}を下へ移動`}
            disabled={index === total - 1 || mutation.isPending}
            size="icon"
            variant="outline"
            onClick={() => mutation.mutate({ sortOrder: index + 1 })}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label={
              itemType.isVisible
                ? `${itemType.name}を非表示`
                : `${itemType.name}を表示`
            }
            disabled={mutation.isPending}
            size="icon"
            variant="outline"
            onClick={() => mutation.mutate({ isVisible: !itemType.isVisible })}
          >
            {itemType.isVisible ? (
              <Eye aria-hidden="true" className="size-4" />
            ) : (
              <EyeOff aria-hidden="true" className="size-4" />
            )}
          </Button>
          <DeleteItemTypeDialog
            projectId={projectId}
            typeId={itemType.id}
            typeName={itemType.name}
          />
        </div>
        <Button
          aria-label={`${itemType.name}の変更を保存`}
          disabled={!changed || mutation.isPending}
          size="icon"
          onClick={() => mutation.mutate({ name, defaultColor, icon })}
        >
          <Save aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive lg:col-span-4">
          {mutation.error.message}
        </p>
      ) : null}
    </li>
  );
}

export function ItemTypeManager({
  projectId,
  initialItemTypes,
}: ItemTypeManagerProps) {
  const queryClient = useQueryClient();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [newColor, setNewColor] = useState("#00B0B0");
  const [newIcon, setNewIcon] = useState("circle-dot");
  const { data: itemTypes = initialItemTypes } = useQuery({
    queryKey: itemTypeKeys.list(projectId),
    queryFn: () => listItemTypes(projectId),
    initialData: initialItemTypes,
  });
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeName(query);
    if (!normalizedQuery) return itemTypes;
    return itemTypes.filter((itemType) =>
      normalizeName(itemType.name).includes(normalizedQuery),
    );
  }, [itemTypes, query]);
  const canCreate =
    normalizeName(query).length > 0 &&
    !itemTypes.some(
      (itemType) => normalizeName(itemType.name) === normalizeName(query),
    );
  const createMutation = useMutation({
    mutationFn: () =>
      createItemType(projectId, {
        name: query,
        defaultColor: newColor,
        icon: newIcon,
      }),
    onSuccess: async () => {
      setQuery("");
      await queryClient.invalidateQueries({
        queryKey: itemTypeKeys.list(projectId),
      });
    },
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={searchId}>タイムライン種別を検索・新規作成</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              role="combobox"
              aria-controls="item-type-list"
              aria-expanded={Boolean(query)}
              aria-autocomplete="list"
              className="pl-9"
              placeholder="例：人物、雑誌、作品"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  canCreate &&
                  !createMutation.isPending
                ) {
                  event.preventDefault();
                  createMutation.mutate();
                }
              }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${searchId}-color`}>新規種別の色</Label>
          <input
            id={`${searchId}-color`}
            className="h-9 w-full min-w-16 cursor-pointer rounded-md border bg-background p-1 sm:w-16"
            type="color"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <ItemTypeIconPicker
            color={newColor}
            value={newIcon}
            onChange={setNewIcon}
          />
        </div>
        <Button
          disabled={!canCreate || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Plus aria-hidden="true" className="size-4" />
          {createMutation.isPending ? "追加中…" : "新規作成"}
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
          <Badge variant="outline">{filtered.length}件表示</Badge>
          {query && !canCreate ? (
            <span>同名のタイムライン種別は追加できません。</span>
          ) : canCreate ? (
            <span>Enterキーでも「{query.trim()}」を追加できます。</span>
          ) : (
            <span>名称の一部を入力すると一覧を絞り込めます。</span>
          )}
        </div>
        {createMutation.error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            {createMutation.error.message}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {filtered.length ? (
          <ul id="item-type-list" aria-label="タイムライン種別一覧">
            {filtered.map((itemType) => {
              const index = itemTypes.findIndex(
                (candidate) => candidate.id === itemType.id,
              );
              return (
                <ItemTypeRow
                  key={itemType.id}
                  index={index}
                  itemType={itemType}
                  projectId={projectId}
                  total={itemTypes.length}
                />
              );
            })}
          </ul>
        ) : (
          <div
            id="item-type-list"
            className="px-6 py-12 text-center text-sm text-muted-foreground"
          >
            一致するタイムライン種別はありません。上の入力から新規作成できます。
          </div>
        )}
      </div>
    </div>
  );
}
