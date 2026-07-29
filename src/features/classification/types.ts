import type { HistoricalDate } from "@/features/timeline-items/types";

export const MARKER_SHAPES = [
  "circle",
  "square",
  "diamond",
  "triangle",
  "star",
  "hexagon",
] as const;
export type MarkerShape = (typeof MARKER_SHAPES)[number];

export type Tag = {
  id: string;
  projectId: string;
  name: string;
  color: string;
  description: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type EventType = {
  id: string;
  projectId: string;
  name: string;
  color: string;
  markerShape: MarkerShape;
  description: string | null;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export const CUSTOM_FIELD_TYPES = [
  "text",
  "multiline",
  "number",
  "boolean",
  "single_select",
  "multi_select",
  "url",
  "historical_date",
  "entity_reference",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
export type CustomFieldEntityType = "timeline_item" | "timeline_event";

export type CustomFieldDefinition = {
  id: string;
  projectId: string;
  entityType: CustomFieldEntityType;
  scope: "project" | "type";
  targetTypeId: string | null;
  name: string;
  fieldType: CustomFieldType;
  isRequired: boolean;
  options: string[];
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EntityReferenceValue = {
  entityType: CustomFieldEntityType;
  entityId: string;
};

export type CustomFieldValue =
  string | number | boolean | string[] | HistoricalDate | EntityReferenceValue;

export type CustomFieldEntry = { fieldId: string; value: CustomFieldValue };
