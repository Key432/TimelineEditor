"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, FileImage, FileText, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadVisualExport } from "@/features/visual-export/client";
import {
  pdfExportOptionsSchema,
  visualExportOptionsSchema,
  type PdfExportOptions,
  type VisualExportOptions,
  type VisualExportSnapshot,
} from "@/features/visual-export/types";

export function VisualExportCard({
  snapshot,
}: {
  snapshot: VisualExportSnapshot | null;
}) {
  const [busy, setBusy] = useState<"svg" | "png" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    pageSize: "a4",
    orientation: "landscape",
    marginMm: 10,
    scaleMode: "fit-width",
  });
  const form = useForm<VisualExportOptions>({
    resolver: zodResolver(visualExportOptionsSchema),
    defaultValues: {
      layout: "row",
      rangeMode: "all",
      customStartYear: snapshot?.project.settings.initialStartYear ?? 1800,
      customEndYear: snapshot?.project.settings.initialEndYear ?? 2026,
      includeTitle: true,
      includeDescription: true,
      includeLegend: true,
    },
  });
  const layout = useWatch({ control: form.control, name: "layout" });
  const rangeMode = useWatch({ control: form.control, name: "rangeMode" });

  async function exportFile(format: "svg" | "png" | "pdf") {
    if (!snapshot) return;
    setError("");
    const valid = await form.trigger();
    if (!valid) return;
    const parsedPdf = pdfExportOptionsSchema.safeParse(pdfOptions);
    if (!parsedPdf.success) {
      setError(parsedPdf.error.issues[0]?.message ?? "PDF設定が不正です。");
      return;
    }
    setBusy(format);
    try {
      await downloadVisualExport(
        format,
        snapshot,
        form.getValues(),
        parsedPdf.data,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "表示ファイルを作成できませんでした。",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>タイムラインを画像・PDFで出力</CardTitle>
        <CardDescription>
          行表示、コンパクト、関連ネットワークをSVG・PNG・PDFへ出力します。生成ファイルはサーバーへ保存しません。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="visual-export-layout">出力する表示</Label>
            <select
              id="visual-export-layout"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              {...form.register("layout")}
            >
              <option value="row">行表示</option>
              <option value="compact">コンパクト</option>
              <option value="network">関連ネットワーク</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="visual-export-range">出力範囲</Label>
            <select
              id="visual-export-range"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
              disabled={layout === "network"}
              {...form.register("rangeMode")}
            >
              <option value="all">全データを出力</option>
              <option value="custom">指定期間を出力</option>
              <option value="viewport">現在の表示範囲を出力</option>
              <option value="highlight" disabled={!snapshot?.highlightRange}>
                期間強調範囲を出力
              </option>
            </select>
            {layout === "network" ? (
              <p className="text-xs text-muted-foreground">
                関連ネットワークは現在のフィルター結果全体を出力します。
              </p>
            ) : null}
          </div>
        </div>

        {layout !== "network" && rangeMode === "custom" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="visual-export-start">開始年</Label>
              <Input
                id="visual-export-start"
                type="number"
                {...form.register("customStartYear", { valueAsNumber: true })}
              />
              {form.formState.errors.customStartYear ? (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.customStartYear.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="visual-export-end">終了年</Label>
              <Input
                id="visual-export-end"
                type="number"
                {...form.register("customEndYear", { valueAsNumber: true })}
              />
              {form.formState.errors.customEndYear ? (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.customEndYear.message}
                </p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              紀元前は負の年で指定します（例：紀元前100年は -100）。
            </p>
          </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">付加情報</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              ["includeTitle", "タイトル"],
              ["includeDescription", "説明"],
              ["includeLegend", "凡例"],
            ].map(([name, label]) => (
              <label key={name} className="flex items-center gap-2">
                <input
                  className="size-4 accent-primary"
                  type="checkbox"
                  {...form.register(name as keyof VisualExportOptions)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">PDF設定</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>用紙サイズ</span>
              <select
                className="h-9 w-full rounded-md border bg-background px-3"
                value={pdfOptions.pageSize}
                onChange={(event) =>
                  setPdfOptions((current) => ({
                    ...current,
                    pageSize: event.target
                      .value as PdfExportOptions["pageSize"],
                  }))
                }
              >
                <option value="a4">A4</option>
                <option value="a3">A3</option>
                <option value="letter">Letter</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>向き</span>
              <select
                className="h-9 w-full rounded-md border bg-background px-3"
                value={pdfOptions.orientation}
                onChange={(event) =>
                  setPdfOptions((current) => ({
                    ...current,
                    orientation: event.target
                      .value as PdfExportOptions["orientation"],
                  }))
                }
              >
                <option value="portrait">縦</option>
                <option value="landscape">横</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>余白（mm）</span>
              <Input
                max={40}
                min={0}
                type="number"
                value={pdfOptions.marginMm}
                onChange={(event) =>
                  setPdfOptions((current) => ({
                    ...current,
                    marginMm: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>縮尺・分割</span>
              <select
                className="h-9 w-full rounded-md border bg-background px-3"
                value={pdfOptions.scaleMode}
                onChange={(event) =>
                  setPdfOptions((current) => ({
                    ...current,
                    scaleMode: event.target
                      .value as PdfExportOptions["scaleMode"],
                  }))
                }
              >
                <option value="fit-page">1ページに全体を縮小</option>
                <option value="fit-height">
                  用紙の縦幅に合わせて全体を縮小
                </option>
                <option value="fit-width">
                  用紙の横幅に合わせて全体を縮小
                </option>
                <option value="original">オリジナルのサイズ</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            用紙を超える方向は複数ページへ分割します。日本語はブラウザで描画してPDFへ埋め込みます。
          </p>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!snapshot || busy !== null}
            type="button"
            onClick={() => void exportFile("svg")}
          >
            {busy === "svg" ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <FileText aria-hidden="true" />
            )}
            SVGを保存
          </Button>
          <Button
            disabled={!snapshot || busy !== null}
            type="button"
            variant="outline"
            onClick={() => void exportFile("png")}
          >
            {busy === "png" ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <FileImage aria-hidden="true" />
            )}
            PNGを保存
          </Button>
          <Button
            disabled={!snapshot || busy !== null}
            type="button"
            variant="outline"
            onClick={() => void exportFile("pdf")}
          >
            {busy === "pdf" ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            PDFを保存
          </Button>
        </div>
        {!snapshot ? (
          <p role="status" className="text-sm text-muted-foreground">
            タイムラインの出力データを準備しています…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
