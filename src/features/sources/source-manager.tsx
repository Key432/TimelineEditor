"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createSource,
  deleteSource,
  listSources,
  sourceKeys,
  updateSource,
} from "@/features/sources/api";
import type { MissingSourceEntity, Source } from "@/features/sources/types";
import type { SourceInput } from "@/features/sources/validation";

function values(source?: Source): SourceInput {
  return {
    title: source?.title ?? "",
    authors: source?.authors ?? [],
    publisher: source?.publisher ?? "",
    publicationYear: source?.publicationYear ?? "",
    isbn: source?.isbn ?? "",
    url: source?.url ?? "",
    accessedOn: source?.accessedOn ?? "",
    citationKey: source?.citationKey ?? "",
    notes: source?.notes ?? "",
  };
}

function SourceFields({
  value,
  onChange,
  prefix,
}: {
  value: SourceInput;
  onChange: (value: SourceInput) => void;
  prefix: string;
}) {
  const field = (name: keyof SourceInput, next: unknown) =>
    onChange({ ...value, [name]: next });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}-title`}>資料名</Label>
        <Input
          id={`${prefix}-title`}
          value={value.title}
          onChange={(event) => field("title", event.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}-authors`}>著者（1行に1名）</Label>
        <Textarea
          id={`${prefix}-authors`}
          rows={2}
          value={(value.authors ?? []).join("\n")}
          onChange={(event) =>
            field(
              "authors",
              event.target.value
                .split("\n")
                .map((author) => author.trim())
                .filter(Boolean),
            )
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-publisher`}>出版社</Label>
        <Input
          id={`${prefix}-publisher`}
          value={value.publisher ?? ""}
          onChange={(event) => field("publisher", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-year`}>刊行年</Label>
        <Input
          id={`${prefix}-year`}
          inputMode="numeric"
          value={value.publicationYear ?? ""}
          onChange={(event) => field("publicationYear", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-isbn`}>ISBN</Label>
        <Input
          id={`${prefix}-isbn`}
          value={value.isbn ?? ""}
          onChange={(event) => field("isbn", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-key`}>引用キー</Label>
        <Input
          id={`${prefix}-key`}
          placeholder="例：tanaka2024"
          value={value.citationKey ?? ""}
          onChange={(event) => field("citationKey", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-url`}>URL</Label>
        <Input
          id={`${prefix}-url`}
          type="url"
          value={value.url ?? ""}
          onChange={(event) => field("url", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-accessed`}>参照日</Label>
        <Input
          id={`${prefix}-accessed`}
          type="date"
          value={value.accessedOn ?? ""}
          onChange={(event) => field("accessedOn", event.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}-notes`}>注記</Label>
        <Textarea
          id={`${prefix}-notes`}
          rows={3}
          value={value.notes ?? ""}
          onChange={(event) => field("notes", event.target.value)}
        />
      </div>
    </div>
  );
}

function SourceRow({
  projectId,
  source,
}: {
  projectId: string;
  source: Source;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SourceInput>(() => values(source));
  const save = useMutation({
    mutationFn: () => updateSource(projectId, source.id, draft),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sourceKeys.list(projectId) }),
  });
  const remove = useMutation({
    mutationFn: () => deleteSource(projectId, source.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sourceKeys.list(projectId) }),
  });
  return (
    <li
      id={`source-${source.id}`}
      className="rounded-xl border target:ring-2 target:ring-primary/50"
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block font-medium">{source.title}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {source.authors.length ? source.authors.join("、") : "著者未登録"}
            </span>
          </span>
          <span className="shrink-0 transition-transform group-open:rotate-180">
            <ChevronDown aria-hidden="true" className="size-4" />
          </span>
        </summary>
        <div className="space-y-4 border-t p-4">
          <SourceFields
            prefix={`source-${source.id}`}
            value={draft}
            onChange={setDraft}
          />
          <div>
            <p className="mb-2 text-sm font-medium">参照中の項目</p>
            {source.references.length ? (
              <ul className="flex flex-wrap gap-2">
                {source.references.map((reference) => (
                  <li key={`${reference.entityType}:${reference.entityId}`}>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/projects/${projectId}/${reference.entityType === "timeline_item" ? "items" : "events"}/${reference.entityId}`}
                      >
                        {reference.title}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                まだ参照されていません。
              </p>
            )}
          </div>
          {(save.error ?? remove.error) ? (
            <p role="alert" className="text-sm text-destructive">
              {(save.error ?? remove.error)?.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              disabled={remove.isPending}
              type="button"
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    `「${source.title}」を削除しますか？ 関連付けも解除されます。`,
                  )
                )
                  remove.mutate();
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              削除
            </Button>
            <Button
              disabled={save.isPending}
              type="button"
              onClick={() => save.mutate()}
            >
              <Save aria-hidden="true" className="size-4" />
              保存
            </Button>
          </div>
        </div>
      </details>
    </li>
  );
}

function MissingList({
  projectId,
  entities,
}: {
  projectId: string;
  entities: MissingSourceEntity[];
}) {
  return entities.length ? (
    <ul className="flex flex-wrap gap-2">
      {entities.map((entity) => (
        <li key={`${entity.entityType}:${entity.entityId}`}>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/projects/${projectId}/${entity.entityType === "timeline_item" ? "items" : "events"}/${entity.entityId}/edit`}
            >
              {entity.title}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">
      出典未設定の項目はありません。
    </p>
  );
}

export function SourceManager({
  projectId,
  initialSources,
  initialMissingEntities,
}: {
  projectId: string;
  initialSources: Source[];
  initialMissingEntities: MissingSourceEntity[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SourceInput>(() => values());
  const {
    data = { sources: initialSources, missingEntities: initialMissingEntities },
  } = useQuery({
    queryKey: sourceKeys.list(projectId),
    queryFn: () => listSources(projectId),
    initialData: {
      sources: initialSources,
      missingEntities: initialMissingEntities,
    },
  });
  const create = useMutation({
    mutationFn: () => createSource(projectId, draft),
    onSuccess: async () => {
      setDraft(values());
      await queryClient.invalidateQueries({
        queryKey: sourceKeys.list(projectId),
      });
    },
  });
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">新しい資料</h2>
          <Badge variant="outline">{data.sources.length}件</Badge>
        </div>
        <SourceFields prefix="new-source" value={draft} onChange={setDraft} />
        {create.error ? (
          <p role="alert" className="text-sm text-destructive">
            {create.error.message}
          </p>
        ) : null}
        <Button
          disabled={!String(draft.title).trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus aria-hidden="true" className="size-4" />
          資料を登録
        </Button>
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">出典未設定の項目</h2>
        <p className="text-sm text-muted-foreground">
          自由記述と詳細出典の両方が空の項目です。
        </p>
        <MissingList entities={data.missingEntities} projectId={projectId} />
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">資料マスタ</h2>
        {data.sources.length ? (
          <ul className="space-y-4">
            {data.sources.map((source) => (
              <SourceRow
                key={source.id}
                projectId={projectId}
                source={source}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            資料はまだ登録されていません。
          </p>
        )}
      </section>
    </div>
  );
}
