"use client";

import { Fragment } from "react";

import type {
  CustomFieldEntry,
  EventType,
  Tag,
} from "@/features/classification/types";
import { MarkerShapeIcon } from "@/features/classification/marker-shape";
import { useClassification } from "@/features/classification/entity-classification-fields";
import { formatHistoricalDate } from "@/features/timeline-items/historical-date";

function valueLabel(value: CustomFieldEntry["value"]) {
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "object" && "year" in value)
    return formatHistoricalDate(value);
  if (typeof value === "object")
    return `${value.entityType === "timeline_item" ? "アイテム" : "イベント"}: ${value.entityId}`;
  return String(value);
}

export function EntityMetadataDisplay({
  projectId,
  tags = [],
  eventType,
  customFields = [],
}: {
  projectId: string;
  tags?: Tag[];
  eventType?: EventType | null;
  customFields?: CustomFieldEntry[];
}) {
  const classification = useClassification(projectId);
  return (
    <>
      {eventType ? (
        <>
          <dt className="text-muted-foreground">イベント種別</dt>
          <dd className="flex items-center gap-2">
            <MarkerShapeIcon
              color={eventType.color}
              shape={eventType.markerShape}
            />
            {eventType.name}
          </dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">タグ</dt>
      <dd>
        {tags.length ? (
          <span className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded px-2 py-0.5 text-xs"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </span>
        ) : (
          "—"
        )}
      </dd>
      {customFields.map((entry) => {
        const definition = classification.data?.customFields.find(
          (field) => field.id === entry.fieldId,
        );
        return (
          <Fragment key={entry.fieldId}>
            <dt className="text-muted-foreground">
              {definition?.name ?? "カスタム項目"}
            </dt>
            <dd>{valueLabel(entry.value)}</dd>
          </Fragment>
        );
      })}
    </>
  );
}
