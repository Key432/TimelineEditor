import { Button } from "@/components/ui/button";
import type { LocalDraftStatus } from "@/features/autosave/use-local-draft";

const labels: Record<LocalDraftStatus, string> = {
  saved: "下書き保存済み",
  saving: "下書きを保存中…",
  unsaved: "未保存の下書きがあります",
  failed: "下書きの保存に失敗しました",
  offline: "オフライン（下書きはこの端末に保存）",
  retrying: "下書き保存を再試行中…",
  conflict: "別のタブでも下書きが変更されています",
};

export function LocalDraftStatusView({
  status,
  onRetry,
}: {
  status: LocalDraftStatus;
  onRetry: () => void;
}) {
  const failed = status === "failed";
  return (
    <div className="flex items-center justify-between gap-3" aria-live="polite">
      <p
        role={failed ? "alert" : "status"}
        className={
          failed ? "text-xs text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {labels[status]}
      </p>
      {failed ? (
        <Button size="sm" type="button" variant="outline" onClick={onRetry}>
          再試行
        </Button>
      ) : null}
    </div>
  );
}
