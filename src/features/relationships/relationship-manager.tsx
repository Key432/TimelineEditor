"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createRelationship,
  deleteRelationship,
  listRelationships,
  relationshipKeys,
  updateRelationship,
} from "@/features/relationships/api";
import {
  DEFAULT_RELATIONSHIP_TYPES,
  type EntityRelationship,
  type RelationshipDataset,
  type RelationshipEntityType,
} from "@/features/relationships/types";
import { relationshipInputSchema } from "@/features/relationships/validation";

type RelationshipInput = z.input<typeof relationshipInputSchema>;
type RelationshipOutput = z.output<typeof relationshipInputSchema>;

const EMPTY_DATASET: RelationshipDataset = { relationships: [], entities: [] };

function defaults(entity?: {
  type: RelationshipEntityType;
  id: string;
}): RelationshipInput {
  return {
    sourceType: entity?.type ?? "timeline_item",
    sourceId: entity?.id ?? "",
    targetType: "timeline_item",
    targetId: "",
    relationType: "影響",
    lineStyle: "single",
    sourceMarker: "none",
    targetMarker: "arrow",
    note: null,
  };
}

function relationshipValues(
  relationship: EntityRelationship,
): RelationshipInput {
  return {
    sourceType: relationship.sourceType,
    sourceId: relationship.sourceId,
    targetType: relationship.targetType,
    targetId: relationship.targetId,
    relationType: relationship.relationType,
    lineStyle: relationship.lineStyle,
    sourceMarker: relationship.sourceMarker,
    targetMarker: relationship.targetMarker,
    note: relationship.note,
  };
}

export function RelationshipManager({
  projectId,
  entity,
  readOnly = false,
  initialData,
}: {
  projectId: string;
  entity?: { type: RelationshipEntityType; id: string };
  readOnly?: boolean;
  initialData?: RelationshipDataset;
}) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: relationshipKeys.all(projectId),
    queryFn: () => listRelationships(projectId),
    initialData,
    enabled: initialData === undefined || !readOnly,
  });
  const data = query.data ?? EMPTY_DATASET;
  const form = useForm<RelationshipInput, unknown, RelationshipOutput>({
    resolver: zodResolver(relationshipInputSchema),
    defaultValues: defaults(entity),
  });
  const [sourceType, targetType, sourceMarker, targetMarker] = useWatch({
    control: form.control,
    name: ["sourceType", "targetType", "sourceMarker", "targetMarker"],
  });
  const relationshipTypes = useMemo(
    () => [
      ...new Set([
        ...DEFAULT_RELATIONSHIP_TYPES,
        ...data.relationships.map((relationship) => relationship.relationType),
      ]),
    ],
    [data.relationships],
  );
  const labels = useMemo(
    () =>
      new Map(
        data.entities.map((option) => [
          `${option.type}:${option.id}`,
          option.title,
        ]),
      ),
    [data.entities],
  );
  const visibleRelationships = entity
    ? data.relationships.filter(
        (relationship) =>
          (relationship.sourceType === entity.type &&
            relationship.sourceId === entity.id) ||
          (relationship.targetType === entity.type &&
            relationship.targetId === entity.id),
      )
    : data.relationships;
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: relationshipKeys.all(projectId),
    });
  const save = useMutation({
    mutationFn: (input: RelationshipOutput) =>
      editingId
        ? updateRelationship(projectId, editingId, input)
        : createRelationship(projectId, input),
    onSuccess: async () => {
      await refresh();
      setEditingId(null);
      form.reset(defaults(entity));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRelationship(projectId, id),
    onSuccess: async () => {
      await refresh();
      setDeletingId(null);
      if (editingId === deletingId) {
        setEditingId(null);
        form.reset(defaults(entity));
      }
    },
  });
  const entityOptions = (type: RelationshipEntityType) =>
    data.entities.filter((option) => option.type === type);
  const entityLabel = (type: RelationshipEntityType, id: string) =>
    labels.get(`${type}:${id}`) ?? "削除済みの項目";

  return (
    <section className="space-y-4" data-testid="relationship-manager">
      <div>
        <h2 className="font-medium">関係性</h2>
        <p className="text-sm text-muted-foreground">
          日本語の既定候補に加えて、プロジェクト固有の関係名を自由に入力できます。
        </p>
      </div>
      {!readOnly ? (
        <form
          className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((input) => save.mutate(input))}
        >
          <div className="space-y-1">
            <Label htmlFor="relationship-source-type">始点の種類</Label>
            <select
              id="relationship-source-type"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              {...form.register("sourceType", {
                onChange: () => form.setValue("sourceId", ""),
              })}
            >
              <option value="timeline_item">タイムラインアイテム</option>
              <option value="timeline_event">イベントアイテム</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="relationship-source">始点</Label>
            <select
              id="relationship-source"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              {...form.register("sourceId")}
            >
              <option value="">選択してください</option>
              {entityOptions(sourceType).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="relationship-target-type">終点の種類</Label>
            <select
              id="relationship-target-type"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              {...form.register("targetType", {
                onChange: () => form.setValue("targetId", ""),
              })}
            >
              <option value="timeline_item">タイムラインアイテム</option>
              <option value="timeline_event">イベントアイテム</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="relationship-target">終点</Label>
            <select
              id="relationship-target"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              {...form.register("targetId")}
            >
              <option value="">選択してください</option>
              {entityOptions(targetType).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="relationship-type">関係種別</Label>
            <Input
              id="relationship-type"
              list="relationship-type-options"
              {...form.register("relationType")}
            />
            <datalist id="relationship-type-options">
              {relationshipTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="relationship-line-style">線</Label>
            <select
              id="relationship-line-style"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              {...form.register("lineStyle")}
            >
              <option value="single">直線</option>
              <option value="double">二重線</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={sourceMarker === "arrow"}
              type="checkbox"
              onChange={(event) =>
                form.setValue(
                  "sourceMarker",
                  event.target.checked ? "arrow" : "none",
                )
              }
            />
            始点に矢印
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={targetMarker === "arrow"}
              type="checkbox"
              onChange={(event) =>
                form.setValue(
                  "targetMarker",
                  event.target.checked ? "arrow" : "none",
                )
              }
            />
            終点に矢印
          </label>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="relationship-note">注記</Label>
            <Textarea id="relationship-note" {...form.register("note")} />
          </div>
          {form.formState.errors.root ||
          Object.keys(form.formState.errors).length ? (
            <p className="text-sm text-destructive sm:col-span-2" role="alert">
              始点・終点・関係種別を確認してください。
            </p>
          ) : null}
          {save.error ? (
            <p className="text-sm text-destructive sm:col-span-2" role="alert">
              {save.error.message}
            </p>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={save.isPending} type="submit">
              {editingId ? "関係性を更新" : "関係性を追加"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  form.reset(defaults(entity));
                }}
              >
                キャンセル
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {visibleRelationships.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            登録済みの関係性はありません。
          </li>
        ) : null}
        {visibleRelationships.map((relationship) => (
          <li key={relationship.id} className="space-y-2 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                {entityLabel(relationship.sourceType, relationship.sourceId)}
                {relationship.sourceMarker === "arrow" ? " ←" : " —"}
                <strong className="mx-1">{relationship.relationType}</strong>
                {relationship.targetMarker === "arrow" ? "→ " : "— "}
                {entityLabel(relationship.targetType, relationship.targetId)}
                <span className="ml-2 text-muted-foreground">
                  {relationship.lineStyle === "double" ? "二重線" : "直線"}
                </span>
              </span>
              {!readOnly ? (
                <>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(relationship.id);
                      form.reset(relationshipValues(relationship));
                    }}
                  >
                    編集
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setDeletingId(relationship.id)}
                  >
                    削除
                  </Button>
                </>
              ) : null}
            </div>
            {relationship.note ? (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {relationship.note}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>関係性を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              タイムライン上の線も表示されなくなります。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => {
                if (deletingId) remove.mutate(deletingId);
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
