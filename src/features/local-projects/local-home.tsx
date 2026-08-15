"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  Cloud,
  Download,
  FolderPlus,
  LogIn,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useForm, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCsvArchive,
  csvArchiveFileName,
  jsonExportFileName,
  parseCsvImport,
} from "@/features/import-export/csv";
import {
  previewBackup,
  type ProjectBackup,
} from "@/features/import-export/schema";
import {
  localBackgroundLayers,
  localItemTypes,
  localProjectForTimeline,
  localRelationships,
  localTimelineEvents,
  localTimelineItems,
} from "@/features/local-projects/adapters";
import {
  createLocalProject,
  searchLocalProject,
  updateLocalProject,
} from "@/features/local-projects/model";
import {
  deleteLocalProject,
  estimateLocalStorage,
  listLocalProjects,
  putLocalProject,
} from "@/features/local-projects/store";
import type { LocalProjectRecord } from "@/features/local-projects/types";
import {
  localEventCreateSchema,
  localItemCreateSchema,
  localProjectCreateSchema,
} from "@/features/local-projects/validation";
import { PROJECT_TEMPLATE_LABELS } from "@/features/projects/types";
import { TimelineWorkspace } from "@/features/timeline-items/timeline-workspace";
import {
  DEFAULT_TIMELINE_FILTERS,
  type TimelineFilters,
} from "@/features/timeline-items/timeline-filters";

type ProjectInput = Parameters<typeof localProjectCreateSchema.parse>[0];

const yearDate = (year: number, era: "ce" | "bce") => ({
  era,
  precision: "year" as const,
  year,
  month: null,
  day: null,
  originalText: null,
  calendar: "proleptic_gregorian",
});

const editableDate = (
  date: ProjectBackup["timelineEvents"][number]["date"] | null | undefined,
) => date ?? yearDate(new Date().getUTCFullYear(), "ce");

const LOGIN_CALLOUT_KEY = "timeline-editor:hide-login-callout:v1";
const LOGIN_CALLOUT_EVENT = "timeline-editor:login-callout";

function subscribeLoginCallout(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOGIN_CALLOUT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOGIN_CALLOUT_EVENT, callback);
  };
}

function loginCalloutSnapshot() {
  try {
    return window.localStorage.getItem(LOGIN_CALLOUT_KEY) !== "true";
  } catch {
    return true;
  }
}

function download(name: string, contents: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function ProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: ProjectInput) => void;
}) {
  const form = useForm({
    resolver: standardSchemaResolver(localProjectCreateSchema),
    defaultValues: { name: "", description: "", template: "general" as const },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ローカルプロジェクトを作成</DialogTitle>
          <DialogDescription>
            データはこのブラウザだけに保存され、クラウドへ自動送信されません。
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((value) => onCreate(value))}
        >
          <div className="space-y-2">
            <Label htmlFor="local-project-name">プロジェクト名</Label>
            <Input
              id="local-project-name"
              autoFocus
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="local-project-description">説明（任意）</Label>
            <Textarea
              id="local-project-description"
              {...form.register("description")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="local-project-template">テンプレート</Label>
            <select
              id="local-project-template"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("template")}
            >
              {Object.entries(PROJECT_TEMPLATE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button type="submit">
              <FolderPlus aria-hidden="true" />
              作成
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  record,
  itemId,
  open,
  onOpenChange,
  onSave,
}: {
  record: LocalProjectRecord;
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (backup: ProjectBackup) => void;
}) {
  const item = record.backup.timelineItems.find((value) => value.id === itemId);
  const date = item?.temporalType === "point" ? item.point : item?.start;
  const form = useForm({
    resolver: standardSchemaResolver(localItemCreateSchema),
    values: {
      title: item?.title ?? "",
      typeId: item?.typeId ?? record.backup.itemTypes[0]!.id,
      temporalType: item?.temporalType ?? "range",
      start: editableDate(date),
      endDateStatus: item?.endDateStatus ?? "specified",
      end: editableDate(item?.end ?? item?.lastConfirmed ?? date),
      description: item?.description ?? "",
    },
  });
  const temporalType = useWatch({
    control: form.control,
    name: "temporalType",
  });
  const endDateStatus = useWatch({
    control: form.control,
    name: "endDateStatus",
  });
  const startPrecision = useWatch({
    control: form.control,
    name: "start.precision",
  });
  const endPrecision = useWatch({
    control: form.control,
    name: "end.precision",
  });

  function remove() {
    if (!item || !window.confirm(`「${item.title}」を削除しますか？`)) return;
    const removedEventIds = new Set(
      record.backup.timelineEvents
        .filter(
          (event) =>
            event.timelineItemIds.length === 1 &&
            event.timelineItemIds[0] === item.id,
        )
        .map((event) => event.id),
    );
    onSave({
      ...record.backup,
      timelineItems: record.backup.timelineItems.filter(
        (value) => value.id !== item.id,
      ),
      timelineEvents: record.backup.timelineEvents
        .filter((event) => !removedEventIds.has(event.id))
        .map((event) => ({
          ...event,
          timelineItemIds: event.timelineItemIds.filter((id) => id !== item.id),
        })),
      relationships: record.backup.relationships.filter(
        (relationship) =>
          !(
            relationship.sourceType === "timeline_item" &&
            relationship.sourceId === item.id
          ) &&
          !(
            relationship.targetType === "timeline_item" &&
            relationship.targetId === item.id
          ) &&
          !(
            relationship.sourceType === "timeline_event" &&
            removedEventIds.has(relationship.sourceId)
          ) &&
          !(
            relationship.targetType === "timeline_event" &&
            removedEventIds.has(relationship.targetId)
          ),
      ),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {item ? "タイムラインアイテムを編集" : "タイムラインアイテムを追加"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((value) => {
            const parsed = localItemCreateSchema.parse(value);
            const nowId = item?.id ?? crypto.randomUUID();
            const next = {
              id: nowId,
              typeId: parsed.typeId,
              title: parsed.title,
              aliases: item?.aliases ?? [],
              tagIds: item?.tagIds ?? [],
              customFields: item?.customFields ?? [],
              description: parsed.description?.trim() || null,
              sourceText: item?.sourceText ?? null,
              externalUrl: item?.externalUrl ?? null,
              temporalType: parsed.temporalType,
              colorOverride: item?.colorOverride ?? null,
              manualOrder:
                item?.manualOrder ?? record.backup.timelineItems.length,
              isVisible: item?.isVisible ?? true,
              start: parsed.temporalType === "range" ? parsed.start : null,
              isStartApproximate: item?.isStartApproximate ?? false,
              startUncertaintyYears: item?.startUncertaintyYears ?? null,
              endDateStatus:
                parsed.temporalType === "range" ? parsed.endDateStatus : null,
              end:
                parsed.temporalType === "range" &&
                parsed.endDateStatus === "specified"
                  ? parsed.end!
                  : null,
              isEndApproximate: item?.isEndApproximate ?? false,
              endUncertaintyYears: item?.endUncertaintyYears ?? null,
              lastConfirmed:
                parsed.temporalType === "range" &&
                parsed.endDateStatus === "unknown"
                  ? (parsed.end ?? parsed.start)
                  : null,
              point: parsed.temporalType === "point" ? parsed.start : null,
              isPointApproximate: item?.isPointApproximate ?? false,
            };
            onSave({
              ...record.backup,
              timelineItems: item
                ? record.backup.timelineItems.map((value) =>
                    value.id === item.id ? next : value,
                  )
                : [...record.backup.timelineItems, next],
            });
            onOpenChange(false);
          })}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label>名称</Label>
            <Input aria-label="名称" autoFocus {...form.register("title")} />
          </div>
          <div className="space-y-2">
            <Label>タイムライン種別</Label>
            <select
              className="h-9 w-full rounded-md border px-3"
              aria-label="タイムライン種別"
              {...form.register("typeId")}
            >
              {record.backup.itemTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>時間形式</Label>
            <select
              className="h-9 w-full rounded-md border px-3"
              aria-label="時間形式"
              {...form.register("temporalType")}
            >
              <option value="range">期間</option>
              <option value="point">時点</option>
            </select>
          </div>
          <fieldset className="grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-4">
            <legend className="px-1 text-sm font-medium">
              {temporalType === "point" ? "時点日" : "開始日"}
            </legend>
            <div className="space-y-2">
              <Label>紀元</Label>
              <select
                className="h-9 w-full rounded-md border px-3"
                aria-label={
                  temporalType === "point" ? "日付の紀元" : "開始日の紀元"
                }
                {...form.register("start.era")}
              >
                <option value="ce">西暦</option>
                <option value="bce">紀元前</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>精度</Label>
              <select
                className="h-9 w-full rounded-md border px-3"
                aria-label={
                  temporalType === "point" ? "日付の精度" : "開始日の精度"
                }
                {...form.register("start.precision")}
              >
                <option value="year">年</option>
                <option value="month">年月</option>
                <option value="day">年月日</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>年</Label>
              <Input
                type="number"
                min={1}
                aria-label={temporalType === "point" ? "年" : "開始年"}
                {...form.register("start.year", { valueAsNumber: true })}
              />
            </div>
            {startPrecision === "month" || startPrecision === "day" ? (
              <div className="space-y-2">
                <Label>月</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  aria-label={temporalType === "point" ? "月" : "開始月"}
                  {...form.register("start.month", { valueAsNumber: true })}
                />
              </div>
            ) : null}
            {startPrecision === "day" ? (
              <div className="space-y-2">
                <Label>日</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  aria-label={temporalType === "point" ? "日" : "開始日"}
                  {...form.register("start.day", { valueAsNumber: true })}
                />
              </div>
            ) : null}
          </fieldset>
          {temporalType === "range" ? (
            <>
              <div className="space-y-2">
                <Label>終了状態</Label>
                <select
                  className="h-9 w-full rounded-md border px-3"
                  aria-label="終了状態"
                  {...form.register("endDateStatus")}
                >
                  <option value="specified">終了年あり</option>
                  <option value="ongoing">継続中</option>
                  <option value="unknown">終了不明</option>
                </select>
              </div>
              {endDateStatus !== "ongoing" ? (
                <fieldset className="grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-4">
                  <legend className="px-1 text-sm font-medium">
                    {endDateStatus === "unknown" ? "最終確認日" : "終了日"}
                  </legend>
                  <div className="space-y-2">
                    <Label>紀元</Label>
                    <select
                      className="h-9 w-full rounded-md border px-3"
                      aria-label="終了日の紀元"
                      {...form.register("end.era")}
                    >
                      <option value="ce">西暦</option>
                      <option value="bce">紀元前</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>精度</Label>
                    <select
                      className="h-9 w-full rounded-md border px-3"
                      aria-label="終了日の精度"
                      {...form.register("end.precision")}
                    >
                      <option value="year">年</option>
                      <option value="month">年月</option>
                      <option value="day">年月日</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>年</Label>
                    <Input
                      type="number"
                      min={1}
                      aria-label={
                        endDateStatus === "unknown" ? "最終確認年" : "終了年"
                      }
                      {...form.register("end.year", { valueAsNumber: true })}
                    />
                  </div>
                  {endPrecision === "month" || endPrecision === "day" ? (
                    <div className="space-y-2">
                      <Label>月</Label>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        aria-label="終了月"
                        {...form.register("end.month", { valueAsNumber: true })}
                      />
                    </div>
                  ) : null}
                  {endPrecision === "day" ? (
                    <div className="space-y-2">
                      <Label>日</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        aria-label="終了日"
                        {...form.register("end.day", { valueAsNumber: true })}
                      />
                    </div>
                  ) : null}
                </fieldset>
              ) : null}
            </>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label>本文（任意）</Label>
            <Textarea rows={4} {...form.register("description")} />
          </div>
          {form.formState.errors.root ? (
            <p role="alert">{form.formState.errors.root.message}</p>
          ) : null}
          <div className="flex justify-between sm:col-span-2">
            {item ? (
              <Button type="button" variant="destructive" onClick={remove}>
                <Trash2 aria-hidden="true" />
                削除
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit">保存</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventDialog({
  record,
  eventId,
  open,
  onOpenChange,
  onSave,
}: {
  record: LocalProjectRecord;
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (backup: ProjectBackup) => void;
}) {
  const rangeItems = record.backup.timelineItems.filter(
    (item) => item.temporalType === "range",
  );
  const event = record.backup.timelineEvents.find(
    (candidate) => candidate.id === eventId,
  );
  const form = useForm({
    resolver: standardSchemaResolver(localEventCreateSchema),
    values: {
      title: event?.title ?? "",
      timelineItemIds: event?.timelineItemIds ?? ([] as string[]),
      date: editableDate(event?.date),
      description: event?.description ?? "",
    },
  });
  const datePrecision = useWatch({
    control: form.control,
    name: "date.precision",
  });

  function remove() {
    if (!event || !window.confirm(`「${event.title}」を削除しますか？`)) return;
    onSave({
      ...record.backup,
      timelineEvents: record.backup.timelineEvents.filter(
        (candidate) => candidate.id !== event.id,
      ),
      relationships: record.backup.relationships.filter(
        (relationship) =>
          !(
            relationship.sourceType === "timeline_event" &&
            relationship.sourceId === event.id
          ) &&
          !(
            relationship.targetType === "timeline_event" &&
            relationship.targetId === event.id
          ),
      ),
    });
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {event ? "イベントを編集" : "イベントを追加"}
          </DialogTitle>
          <DialogDescription>
            1件以上の親タイムラインを選択します。
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((value) => {
            const parsed = localEventCreateSchema.parse(value);
            const next = {
              id: event?.id ?? crypto.randomUUID(),
              timelineItemIds: parsed.timelineItemIds,
              title: parsed.title,
              aliases: event?.aliases ?? [],
              eventTypeId: event?.eventTypeId ?? null,
              tagIds: event?.tagIds ?? [],
              customFields: event?.customFields ?? [],
              date: parsed.date,
              isApproximate: event?.isApproximate ?? false,
              description: parsed.description?.trim() || null,
              sourceText: event?.sourceText ?? null,
              externalUrl: event?.externalUrl ?? null,
            };
            onSave({
              ...record.backup,
              timelineEvents: event
                ? record.backup.timelineEvents.map((candidate) =>
                    candidate.id === event.id ? next : candidate,
                  )
                : [...record.backup.timelineEvents, next],
            });
            onOpenChange(false);
          })}
        >
          <div className="space-y-2">
            <Label>イベント名</Label>
            <Input
              aria-label="イベント名"
              autoFocus
              {...form.register("title")}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">親タイムライン</legend>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
              {rangeItems.map((item) => (
                <label className="flex gap-2 text-sm" key={item.id}>
                  <input
                    type="checkbox"
                    value={item.id}
                    {...form.register("timelineItemIds")}
                  />
                  {item.title}
                </label>
              ))}
            </div>
            {form.formState.errors.timelineItemIds ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.timelineItemIds.message}
              </p>
            ) : null}
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <legend className="px-1 text-sm font-medium">日付</legend>
            <div className="space-y-2">
              <Label>紀元</Label>
              <select
                className="h-9 w-full rounded-md border px-3"
                aria-label="日付の紀元"
                {...form.register("date.era")}
              >
                <option value="ce">西暦</option>
                <option value="bce">紀元前</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>精度</Label>
              <select
                className="h-9 w-full rounded-md border px-3"
                aria-label="日付の精度"
                {...form.register("date.precision")}
              >
                <option value="year">年</option>
                <option value="month">年月</option>
                <option value="day">年月日</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>年</Label>
              <Input
                type="number"
                min={1}
                aria-label="年"
                {...form.register("date.year", { valueAsNumber: true })}
              />
            </div>
            {datePrecision === "month" || datePrecision === "day" ? (
              <div className="space-y-2">
                <Label>月</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  aria-label="月"
                  {...form.register("date.month", { valueAsNumber: true })}
                />
              </div>
            ) : null}
            {datePrecision === "day" ? (
              <div className="space-y-2">
                <Label>日</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  aria-label="日"
                  {...form.register("date.day", { valueAsNumber: true })}
                />
              </div>
            ) : null}
          </fieldset>
          <div className="space-y-2">
            <Label>本文（任意）</Label>
            <Textarea {...form.register("description")} />
          </div>
          <div className="flex justify-between">
            {event ? (
              <Button type="button" variant="destructive" onClick={remove}>
                <Trash2 aria-hidden="true" />
                削除
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit">保存</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocalHome() {
  const [projects, setProjects] = useState<LocalProjectRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [eventDialog, setEventDialog] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("保存済み");
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [filters, setFilters] = useState<TimelineFilters>(
    DEFAULT_TIMELINE_FILTERS,
  );
  const storedLoginCalloutVisible = useSyncExternalStore(
    subscribeLoginCallout,
    loginCalloutSnapshot,
    () => true,
  );
  const [loginCalloutDismissed, setLoginCalloutDismissed] = useState(false);
  const showLoginCallout = storedLoginCalloutVisible && !loginCalloutDismissed;
  const fileRef = useRef<HTMLInputElement>(null);
  const selected =
    projects.find((project) => project.id === selectedId) ??
    projects[0] ??
    null;

  useEffect(() => {
    void listLocalProjects()
      .then((values) => {
        setProjects(values);
        setSelectedId(values[0]?.id ?? null);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        setLoaded(true);
        setStatus(
          error instanceof Error
            ? error.message
            : "ローカルデータを読み込めませんでした。",
        );
      });
  }, []);

  async function save(record: LocalProjectRecord) {
    setStatus("保存中…");
    try {
      await putLocalProject(record);
      setProjects((values) => [
        record,
        ...values.filter((value) => value.id !== record.id),
      ]);
      setSelectedId(record.id);
      const estimate = await estimateLocalStorage(record);
      setStorageWarning(
        estimate.isNearLimit
          ? "ブラウザの保存容量が90%に近づいています。バックアップを書き出してください。"
          : null,
      );
      setStatus(
        `保存済み ${new Date(record.updatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "保存に失敗しました。",
      );
    }
  }

  async function importFile(file: File) {
    try {
      let backup: ProjectBackup | undefined;
      if (file.name.toLowerCase().endsWith(".json")) {
        const preview = previewBackup(JSON.parse(await file.text()));
        if (preview.errors.length) throw new Error(preview.errors.join("\n"));
        backup = preview.payload;
      } else {
        if (!selected)
          throw new Error("CSVの取込先プロジェクトを作成してください。");
        const preview = parseCsvImport(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
          selected.backup,
        );
        if (preview.errors.length) throw new Error(preview.errors.join("\n"));
        backup = preview.payload;
      }
      if (!backup) throw new Error("取込データを検証できませんでした。");
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      await save({
        id,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        backup: {
          ...backup,
          exportedAt: now,
          project: {
            ...backup.project,
            id,
            visibility: "private",
            publicId: null,
            publishedAt: null,
          },
        },
      });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "取込に失敗しました。",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeSelectedProject() {
    if (
      !selected ||
      !window.confirm(
        `「${selected.backup.project.name}」をこのブラウザから削除しますか？`,
      )
    )
      return;
    await deleteLocalProject(selected.id);
    const remaining = projects.filter((project) => project.id !== selected.id);
    setProjects(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  }

  function dismissLoginCallout() {
    setLoginCalloutDismissed(true);
    try {
      window.localStorage.setItem(LOGIN_CALLOUT_KEY, "true");
    } catch {
      // The in-memory dismissal still applies in restricted browser contexts.
    }
    window.dispatchEvent(new Event(LOGIN_CALLOUT_EVENT));
  }

  const searchResults = useMemo(
    () => (selected ? searchLocalProject(selected, query) : []),
    [selected, query],
  );
  const items = useMemo(
    () => (selected ? localTimelineItems(selected) : []),
    [selected],
  );
  const events = useMemo(
    () => (selected ? localTimelineEvents(selected) : []),
    [selected],
  );

  return (
    <div className="flex min-h-svh flex-col bg-background lg:h-svh lg:overflow-hidden">
      <header className="flex h-14 shrink-0 items-center border-b bg-card px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden="true" className="size-3 bg-primary" />
          <span className="font-semibold tracking-tight">
            Chronology Studio
          </span>
        </Link>
        <Badge className="ml-3" variant="outline">
          ローカル
        </Badge>
        <div className="relative ml-auto">
          <Button asChild size="sm" variant="outline">
            <Link href="/login">
              <LogIn aria-hidden="true" />
              ログイン
            </Link>
          </Button>
          {showLoginCallout ? (
            <aside
              aria-label="ログインするとできること"
              className="absolute top-[calc(100%+0.75rem)] right-0 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover text-popover-foreground shadow-xl"
              role="note"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 right-6 size-4 rotate-45 border-t border-l bg-popover"
              />
              <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                <div>
                  <p className="font-semibold">ログインするとできること</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ローカル編集に加えてリモートモードの機能を利用できます。
                  </p>
                </div>
                <Button
                  aria-label="案内を閉じる"
                  className="-mt-1 -mr-2 shrink-0"
                  size="icon-sm"
                  variant="ghost"
                  onClick={dismissLoginCallout}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <div
                className="styled-scrollbar max-h-56 overflow-y-auto px-4 py-3"
                data-callout-scroll
              >
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  <li>クラウド保存と端末間同期</li>
                  <li>公開・共有URL</li>
                  <li>変更履歴、ゴミ箱、復元</li>
                  <li>タグ、カスタムフィールド、分類・関係の管理</li>
                  <li>構造化された出典・参考文献の管理</li>
                  <li>テーブル編集、一括操作、CSVマッピング</li>
                  <li>統計・品質チェック</li>
                  <li>プロジェクト横断比較と全体検索</li>
                </ul>
              </div>
            </aside>
          ) : null}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {!loaded ? (
          <p>ローカルデータを読み込んでいます…</p>
        ) : !selected ? (
          <Card className="mx-auto mt-12 max-w-2xl border-dashed">
            <CardHeader>
              <CardTitle>最初の年表を作成しましょう</CardTitle>
              <CardDescription>
                ログインせず、このブラウザ内だけで年表を作成できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => setProjectDialog(true)}>
                <FolderPlus aria-hidden="true" />
                プロジェクトを作成
              </Button>
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                JSONを取り込む
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold">
                    {selected.backup.project.name}
                  </h1>
                  <Badge variant="outline">このブラウザに保存</Badge>
                </div>
                {selected.backup.project.description ? (
                  <p className="text-sm text-muted-foreground">
                    {selected.backup.project.description}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="ローカルプロジェクト"
                  className="h-9 max-w-52 rounded-md border bg-background px-3 text-sm"
                  value={selected.id}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.backup.project.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProjectDialog(true)}
                >
                  <Plus aria-hidden="true" />
                  プロジェクト
                </Button>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
              <Button
                size="sm"
                onClick={() => {
                  setItemId(null);
                  setItemDialog(true);
                }}
              >
                <Plus aria-hidden="true" />
                アイテムを追加
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!items.some((item) => item.temporalType === "range")}
                onClick={() => {
                  setEventId(null);
                  setEventDialog(true);
                }}
              >
                <Plus aria-hidden="true" />
                イベント
              </Button>
              <div className="relative min-w-48 flex-1">
                <Search
                  aria-hidden="true"
                  className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
                />
                <Input
                  aria-label="ローカル全文検索"
                  className="pl-8"
                  placeholder="タイトル・本文・出典を検索"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  download(
                    jsonExportFileName(selected.backup.project.name),
                    JSON.stringify(selected.backup, null, 2),
                    "application/json",
                  )
                }
              >
                <Download aria-hidden="true" />
                JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const bytes = createCsvArchive(selected.backup);
                  download(
                    csvArchiveFileName(selected.backup.project.name),
                    bytes,
                    "application/zip",
                  );
                }}
              >
                <Download aria-hidden="true" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                取込
              </Button>
              <Button
                aria-label="ローカルプロジェクトを削除"
                size="icon-sm"
                variant="ghost"
                onClick={() => void removeSelectedProject()}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {query ? (
              <div
                className="max-h-36 shrink-0 overflow-y-auto rounded-lg border bg-card p-2"
                aria-live="polite"
              >
                {searchResults.length ? (
                  searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        if (result.type === "timeline_item") {
                          setItemId(result.id);
                          setItemDialog(true);
                        } else {
                          setEventId(result.id);
                          setEventDialog(true);
                        }
                      }}
                    >
                      {result.type === "timeline_item"
                        ? "タイムライン"
                        : "イベント"}
                      ：{result.title}
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    一致する項目はありません。
                  </p>
                )}
              </div>
            ) : null}
            {storageWarning ? (
              <p
                role="alert"
                className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                {storageWarning}
              </p>
            ) : null}
            <div className="min-h-[32rem] flex-1">
              <TimelineWorkspace
                key={selected.revision}
                project={localProjectForTimeline(selected)}
                initialItems={items}
                initialEvents={events}
                itemTypes={localItemTypes(selected)}
                initialBackgroundLayers={localBackgroundLayers(selected)}
                initialRelationships={localRelationships(selected)}
                currentDate={yearDate(new Date().getUTCFullYear(), "ce")}
                readOnly
                remoteData={false}
                filters={filters}
                onFiltersChange={setFilters}
                onOpenItem={(id) => {
                  setItemId(id);
                  setItemDialog(true);
                }}
                onOpenEvent={(id) => {
                  setEventId(id);
                  setEventDialog(true);
                }}
              />
            </div>
            <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
              <span>{status}</span>
              <span>
                <Cloud aria-hidden="true" className="mr-1 inline size-3" />
                クラウドへは送信していません
              </span>
            </div>
          </div>
        )}
      </main>
      <input
        ref={fileRef}
        className="hidden"
        type="file"
        accept=".json,.zip,.csv,application/json,application/zip,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
        }}
      />
      <ProjectDialog
        open={projectDialog}
        onOpenChange={setProjectDialog}
        onCreate={(input) => {
          const record = createLocalProject({
            ...localProjectCreateSchema.parse(input),
            currentYear: new Date().getUTCFullYear(),
          });
          void save(record);
          setProjectDialog(false);
        }}
      />
      {selected ? (
        <>
          <ItemDialog
            key={`item-${selected.revision}-${itemId ?? "new"}`}
            record={selected}
            itemId={itemId}
            open={itemDialog}
            onOpenChange={setItemDialog}
            onSave={(backup) =>
              void save(updateLocalProject(selected, () => backup))
            }
          />
          <EventDialog
            key={`event-${selected.revision}-${eventId ?? "new"}`}
            record={selected}
            eventId={eventId}
            open={eventDialog}
            onOpenChange={setEventDialog}
            onSave={(backup) =>
              void save(updateLocalProject(selected, () => backup))
            }
          />
        </>
      ) : null}
    </div>
  );
}
