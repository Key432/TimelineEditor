"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, LoaderCircle, Save, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTimelineEvent } from "@/features/timeline-events/api";
import { emptyTimelineEventValues } from "@/features/timeline-events/validation";
import {
  createTimelineItem,
  listTimelineItems,
} from "@/features/timeline-items/api";
import { parseHistoricalDate } from "@/features/table-view/table-model";
import { emptyTimelineItemValues } from "@/features/timeline-items/validation";
import {
  listCsvMappingProfiles,
  saveCsvMappingProfile,
} from "@/features/table-view/api";
import {
  duplicateRowIndexes,
  mappedValue,
  parseGenericCsv,
  rowsToCsv,
  type CsvTable,
} from "@/features/table-view/generic-csv";
import type { TimelineItemType } from "@/features/item-types/types";

type EntityType = "timeline_item" | "timeline_event";
type DateFormat = "separate" | "iso" | "japanese";

const ITEM_TARGETS = [
  ["title", "名称 *"],
  ["type", "タイムライン種別 *"],
  ["temporalType", "形式（range / point）"],
  ["date", "開始・時点日"],
  ["year", "開始・時点年 *"],
  ["month", "開始・時点月"],
  ["day", "開始・時点日（日）"],
  ["endDateStatus", "終了状態 *"],
  ["endDate", "終了日"],
  ["endYear", "終了年"],
  ["endMonth", "終了月"],
  ["endDay", "終了日（日）"],
  ["externalUrl", "外部URL"],
] as const;

const EVENT_TARGETS = [
  ["title", "名称 *"],
  ["parent", "親タイムライン（IDまたは名称）*"],
  ["date", "イベント日"],
  ["year", "イベント年 *"],
  ["month", "イベント月"],
  ["day", "イベント日（日）"],
  ["externalUrl", "外部URL"],
] as const;

function download(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function mappedDate(
  table: CsvTable,
  row: string[],
  mapping: Record<string, string>,
  format: DateFormat,
  prefix = "",
) {
  if (format !== "separate") {
    const source = mappedValue(table, row, mapping, `${prefix}date`);
    if (format === "japanese") {
      const normalized = source
        .replace(/年/g, "-")
        .replace(/月/g, "-")
        .replace(/日/g, "")
        .replace(/--+/g, "-");
      return parseHistoricalDate(normalized);
    }
    return parseHistoricalDate(source);
  }
  const year = mappedValue(table, row, mapping, `${prefix}year`);
  const month = mappedValue(table, row, mapping, `${prefix}month`);
  const day = mappedValue(table, row, mapping, `${prefix}day`);
  return parseHistoricalDate([year, month, day].filter(Boolean).join("-"));
}

export function GenericCsvImport({
  projectId,
  itemTypes,
  onImported,
}: {
  projectId: string;
  itemTypes: TimelineItemType[];
  onImported?: () => void;
}) {
  const [entityType, setEntityType] = useState<EntityType>("timeline_item");
  const [dateFormat, setDateFormat] = useState<DateFormat>("separate");
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const items = useQuery({
    queryKey: ["projects", projectId, "generic-csv-items"],
    queryFn: () => listTimelineItems(projectId),
  });
  const profiles = useQuery({
    queryKey: ["projects", projectId, "csv-mappings"],
    queryFn: () => listCsvMappingProfiles(projectId),
  });
  const targets = entityType === "timeline_item" ? ITEM_TARGETS : EVENT_TARGETS;
  const preview = useMemo(() => {
    if (!table)
      return {
        errors: [] as { index: number; message: string }[],
        duplicates: [] as number[],
      };
    const errors: { index: number; message: string }[] = [];
    table.rows.forEach((row, index) => {
      const title = mappedValue(table, row, mapping, "title");
      const date = mappedDate(table, row, mapping, dateFormat);
      if (!title) errors.push({ index, message: "名称がありません。" });
      if (!date) errors.push({ index, message: "日付を解釈できません。" });
      if (entityType === "timeline_item") {
        const type = mappedValue(table, row, mapping, "type");
        const temporalType =
          mappedValue(table, row, mapping, "temporalType") || "range";
        const status = mappedValue(table, row, mapping, "endDateStatus");
        if (
          !itemTypes.some(
            (itemType) => itemType.id === type || itemType.name === type,
          )
        )
          errors.push({ index, message: "タイムライン種別が見つかりません。" });
        if (
          temporalType === "range" &&
          !["specified", "ongoing", "unknown"].includes(status)
        )
          errors.push({ index, message: "終了状態が正しくありません。" });
        if (
          temporalType === "range" &&
          status === "specified" &&
          !mappedDate(table, row, mapping, dateFormat, "end")
        )
          errors.push({ index, message: "終了日を解釈できません。" });
      } else {
        const parent = mappedValue(table, row, mapping, "parent");
        if (
          !items.data?.some(
            (item) => item.id === parent || item.title === parent,
          )
        )
          errors.push({ index, message: "親タイムラインが見つかりません。" });
      }
    });
    return {
      errors,
      duplicates: duplicateRowIndexes(
        table,
        mapping,
        (entityType === "timeline_item" ? (items.data ?? []) : []).map(
          (item) => item.title,
        ),
      ),
    };
  }, [dateFormat, entityType, itemTypes, items.data, mapping, table]);
  async function commit() {
    if (!table) return;
    setBusy(true);
    setError("");
    setMessage("");
    const invalid = new Set(preview.errors.map((entry) => entry.index));
    let imported = 0;
    try {
      for (const [index, row] of table.rows.entries()) {
        if (invalid.has(index)) continue;
        const title = mappedValue(table, row, mapping, "title");
        const date = mappedDate(table, row, mapping, dateFormat)!;
        const externalUrl = mappedValue(table, row, mapping, "externalUrl");
        if (entityType === "timeline_item") {
          const typeValue = mappedValue(table, row, mapping, "type");
          const itemType = itemTypes.find(
            (type) => type.id === typeValue || type.name === typeValue,
          )!;
          const temporalType = (mappedValue(
            table,
            row,
            mapping,
            "temporalType",
          ) || "range") as "range" | "point";
          const endDateStatus =
            temporalType === "point"
              ? null
              : (mappedValue(table, row, mapping, "endDateStatus") as
                  "specified" | "ongoing" | "unknown");
          const values = emptyTimelineItemValues(itemType.id);
          await createTimelineItem(projectId, {
            ...values,
            title,
            externalUrl,
            temporalType,
            start: temporalType === "range" ? date : null,
            point: temporalType === "point" ? date : null,
            endDateStatus,
            end:
              endDateStatus === "specified"
                ? mappedDate(table, row, mapping, dateFormat, "end")
                : null,
          });
        } else {
          const parentValue = mappedValue(table, row, mapping, "parent");
          const parent = items.data!.find(
            (item) => item.id === parentValue || item.title === parentValue,
          )!;
          await createTimelineEvent(projectId, {
            ...emptyTimelineEventValues(parent.id, date),
            title,
            externalUrl,
            date,
          });
        }
        imported += 1;
      }
      setMessage(
        `${imported}件を取り込みました。エラー行は取り込んでいません。`,
      );
      onImported?.();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "CSVを取り込めませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="generic-csv-entity">取込先</Label>
          <select
            id="generic-csv-entity"
            className="h-9 w-full rounded-md border px-2"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value as EntityType);
              setMapping({});
            }}
          >
            <option value="timeline_item">タイムライン表</option>
            <option value="timeline_event">イベント表</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="generic-csv-date">日付形式</Label>
          <select
            id="generic-csv-date"
            className="h-9 w-full rounded-md border px-2"
            value={dateFormat}
            onChange={(event) =>
              setDateFormat(event.target.value as DateFormat)
            }
          >
            <option value="separate">年・月・日を別列</option>
            <option value="iso">YYYY-MM-DD</option>
            <option value="japanese">日本語（YYYY年M月D日）</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="generic-csv-profile">保存済みマッピング</Label>
          <select
            id="generic-csv-profile"
            className="h-9 w-full rounded-md border px-2"
            defaultValue=""
            onChange={(event) => {
              const profile = profiles.data?.find(
                (value) => value.id === event.target.value,
              );
              if (profile) {
                setEntityType(profile.entityType);
                setMapping(profile.mapping);
                setDateFormat(profile.dateFormat);
              }
            }}
          >
            <option value="">選択してください</option>
            {profiles.data?.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Input
        aria-label="任意CSVファイル"
        accept="text/csv,.csv"
        type="file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            setTable(parseGenericCsv(await file.text()));
            setError("");
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : "CSVを読み取れません。",
            );
            setTable(null);
          }
        }}
      />
      {table ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="font-medium">列マッピング（先頭5行をプレビュー）</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {targets
              .filter(([key]) =>
                dateFormat === "separate"
                  ? key !== "date" && key !== "endDate"
                  : ![
                      "year",
                      "month",
                      "day",
                      "endYear",
                      "endMonth",
                      "endDay",
                    ].includes(key),
              )
              .map(([key, label]) => (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_1.2fr] items-center gap-2 text-sm"
                >
                  <Label htmlFor={`generic-map-${key}`}>{label}</Label>
                  <div className="flex gap-1">
                    <select
                      id={`generic-map-${key}`}
                      className="h-8 min-w-0 flex-1 rounded-md border px-1"
                      value={
                        mapping[key]?.startsWith("=")
                          ? "__fixed"
                          : (mapping[key] ?? "")
                      }
                      onChange={(event) =>
                        setMapping((value) => ({
                          ...value,
                          [key]:
                            event.target.value === "__fixed"
                              ? "="
                              : event.target.value,
                        }))
                      }
                    >
                      <option value="">未設定</option>
                      {table.headers.map((header) => (
                        <option key={header}>{header}</option>
                      ))}
                      <option value="__fixed">固定値</option>
                    </select>
                    {mapping[key]?.startsWith("=") ? (
                      <Input
                        aria-label={`${label}の固定値`}
                        className="h-8 w-28"
                        value={mapping[key].slice(1)}
                        onChange={(event) =>
                          setMapping((value) => ({
                            ...value,
                            [key]: `=${event.target.value}`,
                          }))
                        }
                      />
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {table.headers.map((header) => (
                    <th key={header} className="border p-1 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    {table.headers.map((header, cell) => (
                      <td key={header} className="border p-1">
                        {row[cell]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            全{table.rows.length}行・エラー
            {new Set(preview.errors.map((entry) => entry.index)).size}
            行・重複候補{preview.duplicates.length}行
          </p>
          {preview.errors.length ? (
            <ul className="max-h-32 overflow-y-auto text-xs text-destructive">
              {preview.errors.slice(0, 50).map((entry, index) => (
                <li key={`${entry.index}-${index}`}>
                  {entry.index + 2}行目: {entry.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || preview.errors.length === table.rows.length}
              onClick={() => void commit()}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              正常行を取り込む
            </Button>
            {preview.errors.length ? (
              <Button
                variant="outline"
                onClick={() => {
                  const indexes = new Set(
                    preview.errors.map((entry) => entry.index),
                  );
                  download(
                    "csv-errors.csv",
                    rowsToCsv(
                      table.headers,
                      table.rows.filter((_, index) => indexes.has(index)),
                    ),
                  );
                }}
              >
                <Download />
                エラー行を再出力
              </Button>
            ) : null}
            <Input
              aria-label="マッピング設定名"
              className="w-48"
              placeholder="マッピング設定名"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
            />
            <Button
              disabled={!profileName.trim()}
              variant="outline"
              onClick={async () => {
                await saveCsvMappingProfile(projectId, {
                  name: profileName,
                  entityType,
                  mapping,
                  dateFormat,
                });
                setProfileName("");
                await profiles.refetch();
              }}
            >
              <Save />
              設定を保存
            </Button>
          </div>
        </div>
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
