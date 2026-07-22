export const PROJECT_TEMPLATES = [
  "literature",
  "art",
  "philosophy",
  "general",
  "empty",
] as const;

export type ProjectTemplate = (typeof PROJECT_TEMPLATES)[number];

export const PROJECT_TEMPLATE_LABELS: Record<ProjectTemplate, string> = {
  literature: "文学史",
  art: "美術史",
  philosophy: "思想史",
  general: "汎用",
  empty: "空のプロジェクト",
};

export type ProjectSettings = {
  defaultUncertaintyYears: number;
  initialStartYear: number;
  initialEndYear: number;
  initialZoomPreset: "fit-range" | "century" | "decade" | "year";
  timelineDensity: "comfortable" | "compact";
  minimumTimeUnit: "year" | "month" | "day";
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  publicId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
};

export type ProjectSummary = Pick<
  Project,
  | "id"
  | "name"
  | "description"
  | "visibility"
  | "publicId"
  | "publishedAt"
  | "updatedAt"
>;
