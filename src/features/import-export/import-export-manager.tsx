"use client";

import {
  Download,
  FileArchive,
  FileJson,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  commitImport,
  previewCsvImport,
  previewJsonImport,
} from "@/features/import-export/api";
import type {
  ImportMode,
  ImportPreview,
} from "@/features/import-export/schema";
import type { TimelineItemType } from "@/features/item-types/types";
import { GenericCsvImport } from "@/features/table-view/generic-csv-import";

function Preview({ preview }: { preview: ImportPreview }) {
  return (
    <div
      className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm"
      aria-live="polite"
    >
      <p className="font-medium">{preview.sourceProjectName}</p>
      <p>
        タイムライン種別 {preview.itemTypeCount}件・タイムライン{" "}
        {preview.timelineItemCount}件・イベント {preview.timelineEventCount}件
      </p>
      {preview.errors.length ? (
        <div role="alert" className="text-destructive">
          <p className="font-medium">エラー</p>
          <ul className="list-disc pl-5">
            {preview.errors.map((error, index) => (
              <li key={`${error}-${index}`}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.warnings.length ? (
        <div className="text-amber-800">
          <p className="font-medium">警告</p>
          <ul className="list-disc pl-5">
            {preview.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ImportExportManager({
  projectId,
  itemTypes = [],
  onImported,
}: {
  projectId: string;
  itemTypes?: TimelineItemType[];
  onImported?: () => void;
}) {
  const router = useRouter();
  const [jsonPreview, setJsonPreview] = useState<ImportPreview | null>(null);
  const [csvPreview, setCsvPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function previewJson(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > 25_000_000)
        throw new Error("25MB以下のJSONファイルを選択してください。");
      setJsonPreview(
        await previewJsonImport(projectId, JSON.parse(await file.text())),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "JSONを読み取れません。",
      );
      setJsonPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function previewCsv(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setCsvPreview(await previewCsvImport(projectId, file));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ZIPを読み取れません。",
      );
      setCsvPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function commit(
    format: "json" | "csv",
    mode: ImportMode,
    preview: ImportPreview,
  ) {
    if (!preview.payload) return;
    if (
      mode === "overwrite" &&
      !window.confirm(
        "現在のプロジェクト内容を完全に置き換えますか？この操作は取り消せません。",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await commitImport(
        projectId,
        format,
        mode,
        preview.payload,
      );
      setMessage(
        `タイムライン種別 ${result.imported.itemTypes}件、タイムライン ${result.imported.timelineItems}件、イベント ${result.imported.timelineEvents}件を取り込みました。`,
      );
      setJsonPreview(null);
      setCsvPreview(null);
      if (onImported) onImported();
      else {
        router.push(`/projects/${result.projectId}/timeline`);
        router.refresh();
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "インポートに失敗しました。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>エクスポート</CardTitle>
          <CardDescription>
            完全バックアップJSON、またはExcelで編集できる3CSV＋READMEのZIPを保存します。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={`/api/projects/${projectId}/export/json`}>
              <FileJson aria-hidden="true" />
              JSONを保存
              <Download aria-hidden="true" />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/projects/${projectId}/export/csv`}>
              <FileArchive aria-hidden="true" />
              CSV ZIPを保存
              <Download aria-hidden="true" />
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>任意CSVをマッピングしてインポート</CardTitle>
          <CardDescription>
            手元のCSV列を項目へ対応付け、固定値や日付形式を指定して正常行だけ取り込みます。元ファイルは保存しません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenericCsvImport
            itemTypes={itemTypes}
            projectId={projectId}
            onImported={onImported}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>JSONをインポート</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            aria-label="JSONバックアップ"
            accept="application/json,.json"
            disabled={busy}
            type="file"
            onChange={(event) => void previewJson(event.target.files?.[0])}
          />
          {jsonPreview ? <Preview preview={jsonPreview} /> : null}
          {jsonPreview?.payload ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                variant="destructive"
                onClick={() => void commit("json", "overwrite", jsonPreview)}
              >
                <Upload aria-hidden="true" />
                現在のプロジェクトを上書き
              </Button>
              <Button
                disabled={busy}
                variant="ghost"
                onClick={() => setJsonPreview(null)}
              >
                中止
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>CSVをインポート</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            aria-label="CSVまたはCSV ZIP"
            accept="text/csv,application/zip,.csv,.zip"
            disabled={busy}
            type="file"
            onChange={(event) => void previewCsv(event.target.files?.[0])}
          />
          {csvPreview ? <Preview preview={csvPreview} /> : null}
          {csvPreview?.payload ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => void commit("csv", "append", csvPreview)}
              >
                <Upload aria-hidden="true" />
                {csvPreview.errors.length
                  ? "正常行のみ取り込む"
                  : "すべて取り込む"}
              </Button>
              <Button
                disabled={busy}
                variant="ghost"
                onClick={() => setCsvPreview(null)}
              >
                全体を中止
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      {busy ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          処理中です。
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
