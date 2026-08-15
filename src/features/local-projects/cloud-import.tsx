"use client";

import { CloudUpload, HardDrive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { commitNewImport } from "@/features/import-export/api";
import { localProjectBytes } from "@/features/local-projects/model";
import { listLocalProjects } from "@/features/local-projects/store";
import type { LocalProjectRecord } from "@/features/local-projects/types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export function LocalProjectCloudImport() {
  const router = useRouter();
  const [projects, setProjects] = useState<LocalProjectRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void listLocalProjects().then((values) => {
      setProjects(values);
      setSelectedId(values[0]?.id ?? "");
    });
  }, []);
  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId),
    [projects, selectedId],
  );
  if (projects.length === 0) return null;

  async function importSelected() {
    if (!selected) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await commitNewImport(selected.backup);
      setMessage(
        "クラウドへ取り込みました。安全のためローカルデータは残しています。",
      );
      router.push(`/projects/${result.projectId}/timeline`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "取り込みに失敗しました。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HardDrive aria-hidden="true" className="size-5" />
          ローカルプロジェクト
        </CardTitle>
        <CardDescription>
          このブラウザで作成したプロジェクトを選び、明示的にクラウドへ取り込みます。ID、内部リンク、複数親、関係は一括変換されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="local-cloud-project"
            >
              取り込むプロジェクト
            </label>
            <select
              id="local-cloud-project"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.backup.project.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={!selected || pending}
            onClick={() => void importSelected()}
          >
            <CloudUpload aria-hidden="true" />
            {pending ? "取り込み中…" : "クラウドへ取り込む"}
          </Button>
        </div>
        {selected ? (
          <p className="text-xs text-muted-foreground">
            概算容量 {formatBytes(localProjectBytes(selected))}・タイムライン
            {selected.backup.timelineItems.length.toLocaleString("ja-JP")}
            件・イベント
            {selected.backup.timelineEvents.length.toLocaleString("ja-JP")}
            件。取り込み成功後もローカルデータは自動削除しません。
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
