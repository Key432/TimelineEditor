import {
  IMPORT_SCHEMA_VERSION,
  projectBackupSchema,
  type ProjectBackup,
} from "@/features/import-export/schema";
import type {
  ProjectSettings,
  ProjectTemplate,
} from "@/features/projects/types";
import type { LocalProjectRecord } from "@/features/local-projects/types";

const TEMPLATE_TYPES: Record<
  ProjectTemplate,
  Array<[name: string, color: string, icon: string]>
> = {
  literature: [
    ["人物", "#2878B5", "user-round"],
    ["文学運動", "#8B5CF6", "sparkles"],
    ["雑誌", "#D97706", "newspaper"],
    ["団体", "#27845A", "users-round"],
    ["作品", "#C73D4D", "book-open"],
    ["政治・社会的事件", "#6B7280", "landmark"],
    ["その他イベント", "#64748B", "circle-dot"],
  ],
  art: [
    ["人物", "#2878B5", "user-round"],
    ["芸術運動", "#8B5CF6", "sparkles"],
    ["団体", "#27845A", "users-round"],
    ["作品", "#C73D4D", "image"],
    ["展覧会・公演", "#D97706", "gallery-horizontal"],
    ["政治・社会的事件", "#6B7280", "landmark"],
    ["その他イベント", "#64748B", "circle-dot"],
  ],
  philosophy: [
    ["人物", "#2878B5", "user-round"],
    ["思想潮流", "#8B5CF6", "brain"],
    ["団体", "#27845A", "users-round"],
    ["作品", "#C73D4D", "book-open"],
    ["政治・社会的事件", "#6B7280", "landmark"],
    ["その他イベント", "#64748B", "circle-dot"],
  ],
  general: [
    ["人物", "#2878B5", "user-round"],
    ["思想潮流", "#8B5CF6", "brain"],
    ["文学運動／芸術運動", "#A855F7", "sparkles"],
    ["雑誌", "#D97706", "newspaper"],
    ["団体", "#27845A", "users-round"],
    ["作品", "#C73D4D", "book-open"],
    ["戦争", "#B45309", "swords"],
    ["政治・社会的事件", "#6B7280", "landmark"],
    ["展覧会・公演", "#DB2777", "gallery-horizontal"],
    ["その他イベント", "#64748B", "circle-dot"],
  ],
  empty: [["未分類", "#64748B", "circle-dot"]],
};

const defaultSettings = (currentYear: number): ProjectSettings => ({
  defaultUncertaintyYears: 5,
  initialStartYear: 1800,
  initialEndYear: currentYear,
  initialZoomPreset: "fit-range",
  timelineDensity: "comfortable",
  minimumTimeUnit: "day",
});

export function createLocalProject(input: {
  name: string;
  description?: string | null;
  template: ProjectTemplate;
  currentYear?: number;
  now?: Date;
}): LocalProjectRecord {
  const now = (input.now ?? new Date()).toISOString();
  const id = crypto.randomUUID();
  const backup: ProjectBackup = {
    schemaVersion: IMPORT_SCHEMA_VERSION,
    appVersion: "0.1.0",
    exportedAt: now,
    project: {
      id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      visibility: "private",
      publicId: null,
      publishedAt: null,
    },
    settings: defaultSettings(input.currentYear ?? new Date().getUTCFullYear()),
    itemTypes: TEMPLATE_TYPES[input.template].map(
      ([name, defaultColor, icon], sortOrder) => ({
        id: crypto.randomUUID(),
        name,
        defaultColor,
        icon,
        sortOrder,
        isVisible: true,
      }),
    ),
    tags: [],
    eventTypes: [],
    customFields: [],
    timelineItems: [],
    timelineEvents: [],
    backgroundLayers: [],
    relationships: [],
  };
  return { id, revision: 1, createdAt: now, updatedAt: now, backup };
}

export function normalizeLocalProject(input: unknown): LocalProjectRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("ローカルプロジェクトが不正です。");
  }
  const candidate = input as Partial<LocalProjectRecord>;
  const backup = projectBackupSchema.parse(candidate.backup);
  const now = new Date().toISOString();
  return {
    id: candidate.id ?? backup.project.id,
    revision: Number.isInteger(candidate.revision) ? candidate.revision! : 1,
    createdAt: candidate.createdAt ?? backup.exportedAt ?? now,
    updatedAt: candidate.updatedAt ?? backup.exportedAt ?? now,
    backup,
  };
}

export function updateLocalProject(
  record: LocalProjectRecord,
  update: (backup: ProjectBackup) => ProjectBackup,
  now = new Date(),
): LocalProjectRecord {
  const updatedAt = now.toISOString();
  const backup = projectBackupSchema.parse({
    ...update(structuredClone(record.backup)),
    exportedAt: updatedAt,
  });
  return {
    ...record,
    revision: record.revision + 1,
    updatedAt,
    backup,
  };
}

export function localProjectBytes(record: LocalProjectRecord) {
  return new Blob([JSON.stringify(record)]).size;
}

export function searchLocalProject(record: LocalProjectRecord, query: string) {
  const normalized = query.trim().normalize("NFKC").toLocaleLowerCase("ja");
  if (!normalized) return [];
  const includes = (...values: Array<string | null | undefined>) =>
    values.some((value) =>
      value?.normalize("NFKC").toLocaleLowerCase("ja").includes(normalized),
    );
  return [
    ...record.backup.timelineItems
      .filter((item) =>
        includes(
          item.title,
          ...item.aliases,
          item.description,
          item.sourceText,
        ),
      )
      .map((item) => ({ type: "timeline_item" as const, ...item })),
    ...record.backup.timelineEvents
      .filter((event) =>
        includes(
          event.title,
          ...event.aliases,
          event.description,
          event.sourceText,
        ),
      )
      .map((event) => ({ type: "timeline_event" as const, ...event })),
  ];
}
