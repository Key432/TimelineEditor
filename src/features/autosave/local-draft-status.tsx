import { Button } from "@/components/ui/button";
import type { LocalDraftStatus } from "@/features/autosave/use-local-draft";

const labels: Record<LocalDraftStatus, string> = {
  saved: "クラウド下書き保存済み",
  saving: "下書きをクラウドへ保存中…",
  unsaved: "未保存の下書きがあります",
  failed: "クラウド保存に失敗しました（この端末には保存済み）",
  offline: "オフライン（下書きはこの端末に保存）",
  retrying: "クラウド保存を再試行中…",
  conflict: "別の端末またはタブの下書きと競合しています",
};

export function LocalDraftStatusView({
  status,
  onRetry,
  onUseCloudVersion,
  onUseThisDeviceVersion,
  canUseCloudVersion,
}: {
  status: LocalDraftStatus;
  onRetry: () => void;
  onUseCloudVersion: () => void;
  onUseThisDeviceVersion: () => void;
  canUseCloudVersion: boolean;
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
      ) : status === "conflict" ? (
        <div className="flex shrink-0 gap-2">
          {canUseCloudVersion ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={onUseCloudVersion}
            >
              クラウド版を使う
            </Button>
          ) : null}
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={onUseThisDeviceVersion}
          >
            この端末版を保存
          </Button>
        </div>
      ) : null}
    </div>
  );
}
