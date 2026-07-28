"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSource, listSources, sourceKeys } from "@/features/sources/api";
import type { SourceCitationInput } from "@/features/sources/validation";

export function SourceCitationFields({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: SourceCitationInput[];
  onChange: (value: SourceCitationInput[]) => void;
}) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const { data = { sources: [], missingEntities: [] } } = useQuery({
    queryKey: sourceKeys.list(projectId),
    queryFn: () => listSources(projectId),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createSource(projectId, {
        title: newTitle,
        authors: [],
        publisher: "",
        publicationYear: "",
        isbn: "",
        url: "",
        accessedOn: "",
        citationKey: "",
        notes: "",
      }),
    onSuccess: async (source) => {
      setNewTitle("");
      await queryClient.invalidateQueries({
        queryKey: sourceKeys.list(projectId),
      });
      onChange([
        ...value,
        { sourceId: source.id, pages: "", chapter: "", quote: "", notes: "" },
      ]);
    },
  });

  function toggle(sourceId: string, checked: boolean) {
    onChange(
      checked
        ? [...value, { sourceId, pages: "", chapter: "", quote: "", notes: "" }]
        : value.filter((citation) => citation.sourceId !== sourceId),
    );
  }

  function update(
    sourceId: string,
    field: "pages" | "chapter" | "quote" | "notes",
    next: string,
  ) {
    onChange(
      value.map((citation) =>
        citation.sourceId === sourceId
          ? { ...citation, [field]: next }
          : citation,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          資料マスタから再利用し、項目ごとのページ・章・引用箇所を記録できます。
        </p>
        <Button asChild size="sm" type="button" variant="outline">
          <Link href={`/projects/${projectId}/sources`} target="_blank">
            <BookOpen aria-hidden="true" className="size-4" />
            資料マスタを管理
          </Link>
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          aria-label="新しい資料名"
          placeholder="資料名だけ先に登録"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
        />
        <Button
          disabled={!newTitle.trim() || createMutation.isPending}
          type="button"
          variant="outline"
          onClick={() => createMutation.mutate()}
        >
          <Plus aria-hidden="true" className="size-4" />
          追加
        </Button>
      </div>
      {createMutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {createMutation.error.message}
        </p>
      ) : null}
      {data.sources.length ? (
        <ul aria-label="詳細出典一覧" className="divide-y rounded-lg border">
          {data.sources.map((source) => {
            const citation = value.find(
              (candidate) => candidate.sourceId === source.id,
            );
            return (
              <li key={source.id} className="space-y-3 p-3">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    checked={Boolean(citation)}
                    className="mt-1 size-4 accent-primary"
                    type="checkbox"
                    onChange={(event) =>
                      toggle(source.id, event.target.checked)
                    }
                  />
                  <span>
                    <span className="block font-medium">{source.title}</span>
                    <span className="text-muted-foreground">
                      {[
                        source.authors.join("、"),
                        source.publicationYear,
                        source.publisher,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "書誌情報未入力"}
                    </span>
                  </span>
                </label>
                {citation ? (
                  <div className="grid gap-3 pl-7 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`citation-pages-${source.id}`}>
                        ページ
                      </Label>
                      <Input
                        id={`citation-pages-${source.id}`}
                        placeholder="例：123–128"
                        value={citation.pages ?? ""}
                        onChange={(event) =>
                          update(source.id, "pages", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`citation-chapter-${source.id}`}>
                        章
                      </Label>
                      <Input
                        id={`citation-chapter-${source.id}`}
                        value={citation.chapter ?? ""}
                        onChange={(event) =>
                          update(source.id, "chapter", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor={`citation-quote-${source.id}`}>
                        引用箇所
                      </Label>
                      <Textarea
                        id={`citation-quote-${source.id}`}
                        rows={2}
                        value={citation.quote ?? ""}
                        onChange={(event) =>
                          update(source.id, "quote", event.target.value)
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          資料マスタはまだありません。上の欄から資料名を登録できます。
        </p>
      )}
    </div>
  );
}
