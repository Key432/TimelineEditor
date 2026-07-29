"use client";

import { FileArchive, FileJson, LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  commitNewImport,
  previewNewCsvImport,
  previewNewJsonImport,
} from "@/features/import-export/api";
import type { ImportPreview } from "@/features/import-export/schema";

function Preview({ value }: { value: ImportPreview }) {
  return (
    <div
      className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm"
      aria-live="polite"
    >
      <p className="font-medium">{value.sourceProjectName}</p>
      <p>
        タイムライン種別 {value.itemTypeCount}件・タイムライン{" "}
        {value.timelineItemCount}
        件・イベント {value.timelineEventCount}件
      </p>
      {value.errors.length ? (
        <ul className="list-disc pl-5 text-destructive" role="alert">
          {value.errors.map((error, index) => (
            <li key={`${error}-${index}`}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function NewProjectImport() {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(file: File | undefined, format: "json" | "csv") {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 25_000_000)
        throw new Error("25MB以下のファイルを選択してください。");
      setPreview(
        format === "json"
          ? await previewNewJsonImport(JSON.parse(await file.text()))
          : await previewNewCsvImport(file),
      );
    } catch (reason) {
      setPreview(null);
      setError(
        reason instanceof Error ? reason.message : "ファイルを読み取れません。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview?.payload) return;
    setBusy(true);
    setError("");
    try {
      const result = await commitNewImport(preview.payload);
      router.push(`/projects/${result.projectId}/timeline`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "インポートに失敗しました。",
      );
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ファイルから作成</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <FileJson className="size-4" aria-hidden="true" />
            JSON
          </span>
          <Input
            aria-label="JSONから新規作成"
            accept="application/json,.json"
            disabled={busy}
            type="file"
            onChange={(event) => void load(event.target.files?.[0], "json")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <FileArchive className="size-4" aria-hidden="true" />
            CSV ZIP
          </span>
          <Input
            aria-label="CSV ZIPから新規作成"
            accept="application/zip,.zip"
            disabled={busy}
            type="file"
            onChange={(event) => void load(event.target.files?.[0], "csv")}
          />
        </label>
        {preview ? <Preview value={preview} /> : null}
        {preview?.payload ? (
          <Button disabled={busy} onClick={() => void commit()}>
            <Upload aria-hidden="true" />
            このデータで作成
          </Button>
        ) : null}
        {busy ? (
          <p className="flex items-center gap-2 text-sm" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            処理中です。
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
