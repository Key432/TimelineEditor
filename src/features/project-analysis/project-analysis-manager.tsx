"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DuplicateCandidate,
  QualityIssue,
  QualityIssueKind,
} from "@/features/project-analysis/analysis";
import {
  getProjectAnalysis,
  mergeEntities,
  previewEntityMerge,
  projectAnalysisKeys,
  undoEntityMerge,
} from "@/features/project-analysis/api";
import { timelineEventKeys } from "@/features/timeline-events/api";
import { timelineItemKeys } from "@/features/timeline-items/api";

const ISSUE_LABELS: Record<QualityIssueKind, string> = {
  broken_internal_link: "内部リンク切れ",
  deleted_reference: "削除済み参照",
  orphan_event: "親なしイベント",
  event_outside_all_parents: "親の期間外",
  missing_source: "出典不足",
  missing_description: "本文不足",
  missing_required_custom_field: "必須項目不足",
  invalid_external_url: "不正な外部URL",
  unused_master: "未使用マスタ",
  orphan_relationship: "孤立した関係",
  markdown_syntax: "Markdown記法",
};

function entityPath(projectId: string, issue: QualityIssue) {
  if (!issue.entityType || !issue.entityId) return null;
  const segment = issue.entityType === "timeline_item" ? "items" : "events";
  return `/projects/${projectId}/${segment}/${issue.entityId}/edit`;
}

function MergeDialog({
  candidate,
  projectId,
  onMerged,
  onOpenChange,
}: {
  candidate: DuplicateCandidate | null;
  projectId: string;
  onMerged: (operationId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [survivorId, setSurvivorId] = useState(candidate?.left.id ?? "");
  const mergedId = candidate
    ? survivorId === candidate.left.id
      ? candidate.right.id
      : candidate.left.id
    : "";
  const mergeInput = candidate
    ? { entityType: candidate.left.entityType, survivorId, mergedId }
    : null;
  const preview = useQuery({
    queryKey: ["merge-preview", projectId, survivorId, mergedId],
    queryFn: () => previewEntityMerge(projectId, mergeInput!),
    enabled: Boolean(mergeInput),
  });
  const merge = useMutation({
    mutationFn: () => mergeEntities(projectId, mergeInput!),
    onSuccess: (result) => {
      onMerged(result.operationId);
      onOpenChange(false);
    },
  });
  const transfers = preview.data?.transfers;

  return (
    <Dialog open={Boolean(candidate)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>重複データの統合プレビュー</DialogTitle>
          <DialogDescription>
            残す側を選んでください。削除側の参照と付加情報を残す側へ移し、削除側はゴミ箱へ移動します。
          </DialogDescription>
        </DialogHeader>
        {candidate ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">残すデータ</legend>
            {[candidate.left, candidate.right].map((entity) => (
              <label
                key={entity.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
              >
                <input
                  type="radio"
                  name="merge-survivor"
                  value={entity.id}
                  checked={survivorId === entity.id}
                  onChange={() => setSurvivorId(entity.id)}
                />
                <span>{entity.title}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {preview.isLoading ? (
          <p className="text-muted-foreground">
            付け替える参照を確認しています…
          </p>
        ) : null}
        {transfers ? (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="mb-2 font-medium">統合される情報</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt>タグ</dt>
              <dd>{transfers.tags}件</dd>
              <dt>出典</dt>
              <dd>{transfers.citations}件</dd>
              <dt>カスタムフィールド</dt>
              <dd>{transfers.customFields}件</dd>
              <dt>同じカスタムフィールド</dt>
              <dd>{transfers.customFieldConflicts}件</dd>
              <dt>親・イベント</dt>
              <dd>{transfers.parentsOrEvents}件</dd>
              <dt>内部リンク</dt>
              <dd>{transfers.internalLinks}件</dd>
              <dt>関係</dt>
              <dd>{transfers.relationships}件</dd>
            </dl>
            {transfers.customFieldConflicts ? (
              <p className="mt-2 text-xs text-muted-foreground">
                同じカスタムフィールドに両方の値がある場合は、残す側の値を優先します。
              </p>
            ) : null}
          </div>
        ) : null}
        {preview.error || merge.error ? (
          <p role="alert" className="text-sm text-destructive">
            {(preview.error ?? merge.error)?.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            disabled={!transfers || merge.isPending}
            onClick={() => merge.mutate()}
          >
            {merge.isPending ? "統合しています…" : "この内容で統合"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectAnalysisManager({
  projectId,
  onOpenClassification,
}: {
  projectId: string;
  onOpenClassification: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [candidate, setCandidate] = useState<DuplicateCandidate | null>(null);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);
  const key = projectAnalysisKeys.detail(projectId);
  const analysis = useQuery({
    queryKey: key,
    queryFn: () => getProjectAnalysis(projectId),
  });
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({
        queryKey: timelineItemKeys.list(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: timelineEventKeys.list(projectId),
      }),
    ]);
    router.refresh();
  }
  const undo = useMutation({
    mutationFn: () => undoEntityMerge(projectId, lastOperationId!),
    onSuccess: async () => {
      setLastOperationId(null);
      await refresh();
    },
  });

  if (analysis.isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        データ品質を確認しています…
      </p>
    );
  if (analysis.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {analysis.error.message}
      </p>
    );
  const data = analysis.data!;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">品質チェック</h2>
            <p className="text-sm text-muted-foreground">
              保存せず、その時点のプロジェクトデータから診断します。
            </p>
          </div>
          <Badge variant={data.issues.length ? "secondary" : "outline"}>
            {data.issues.length}件
          </Badge>
        </div>
        {lastOperationId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <span className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              統合が完了しました。
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={undo.isPending}
              onClick={() => undo.mutate()}
            >
              <RotateCcw className="size-4" />
              {undo.isPending ? "戻しています…" : "統合をUndo"}
            </Button>
          </div>
        ) : null}
        {undo.error ? (
          <p role="alert" className="text-sm text-destructive">
            {undo.error.message}
          </p>
        ) : null}
        {data.issues.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            修正が必要な問題はありません。
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {data.issues.map((issue) => {
              const path = entityPath(projectId, issue);
              return (
                <li
                  key={issue.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="size-4 text-secondary" />
                      {issue.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ISSUE_LABELS[issue.kind]} · {issue.detail}
                    </p>
                  </div>
                  {path ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(path)}
                    >
                      修正する
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : issue.kind === "unused_master" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onOpenClassification}
                    >
                      マスタを管理
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">重複候補</h2>
            <p className="text-sm text-muted-foreground">
              名称・別名・日付・種別・親・外部URL・類似文字列を組み合わせて判定します。
            </p>
          </div>
          <Badge variant="outline">{data.duplicates.length}組</Badge>
        </div>
        {data.duplicates.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            重複候補はありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {data.duplicates.map((entry) => (
              <li
                key={`${entry.left.id}:${entry.right.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {entry.left.title} / {entry.right.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    一致度 {entry.score}% · {entry.reasons.join("・")}
                  </p>
                </div>
                <Button size="sm" onClick={() => setCandidate(entry)}>
                  統合を確認
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <MergeDialog
        key={
          candidate ? `${candidate.left.id}:${candidate.right.id}` : "closed"
        }
        candidate={candidate}
        projectId={projectId}
        onOpenChange={(open) => {
          if (!open) setCandidate(null);
        }}
        onMerged={(operationId) => {
          setLastOperationId(operationId);
          void refresh();
        }}
      />
    </div>
  );
}
