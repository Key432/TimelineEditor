import { historicalDateFromOrdinal } from "@/features/timeline-items/historical-date";

export type AnalysisEntityType = "timeline_item" | "timeline_event";

export type AnalysisEntity = {
  id: string;
  entityType: AnalysisEntityType;
  title: string;
  aliases: string[];
  typeId: string | null;
  tagIds: string[];
  parentIds: string[];
  dateStart: number;
  dateEnd: number;
  description: string | null;
  sourceMissing: boolean;
  externalUrl: string | null;
  requiredFieldIds: string[];
  filledFieldIds: string[];
  createdAt?: string;
  datePrecision?: "day" | "month" | "year" | "decade" | "century";
  endDateStatus?: "specified" | "ongoing" | "unknown" | null;
  isStartApproximate?: boolean;
  isEndApproximate?: boolean;
  isVisible?: boolean;
  hasCustomColor?: boolean;
};

export type AnalysisMaster = {
  kind: "tag" | "timeline_item_type" | "event_type";
  id: string;
  name: string;
  usageCount: number;
};

export type AnalysisReference = {
  kind: "internal_link" | "custom_field" | "relationship";
  sourceType: AnalysisEntityType;
  sourceId: string;
  targetType: AnalysisEntityType;
  targetId: string;
  targetState: "active" | "deleted" | "missing";
  relationType?: string;
};

export type ProjectAnalysisDataset = {
  entities: AnalysisEntity[];
  masters: AnalysisMaster[];
  references: AnalysisReference[];
};

export type QualityIssueKind =
  | "broken_internal_link"
  | "deleted_reference"
  | "orphan_event"
  | "event_outside_all_parents"
  | "missing_source"
  | "missing_description"
  | "missing_required_custom_field"
  | "invalid_external_url"
  | "unused_master"
  | "orphan_relationship"
  | "markdown_syntax";

export type QualityIssue = {
  id: string;
  title: string;
  reasons: Array<{
    kind: QualityIssueKind;
    detail: string;
    count: number;
  }>;
  entityType?: AnalysisEntityType;
  entityId?: string;
  masterKind?: AnalysisMaster["kind"];
  masterId?: string;
};

type AtomicQualityIssue = Omit<QualityIssue, "reasons"> & {
  kind: QualityIssueKind;
  detail: string;
};

export type DuplicateCandidate = {
  left: Pick<AnalysisEntity, "id" | "entityType" | "title">;
  right: Pick<AnalysisEntity, "id" | "entityType" | "title">;
  score: number;
  reasons: string[];
};

export type ProjectAnalysisSummary = {
  itemCount: number;
  eventCount: number;
  missingSourceCount: number;
  missingDescriptionCount: number;
  brokenLinkCount: number;
  multipleParentEventCount: number;
  countsByType: Record<string, number>;
  countsByTag: Record<string, number>;
};

export type AnalysisEntityLink = Pick<
  AnalysisEntity,
  "id" | "entityType" | "title"
>;

export type StatisticDatum = {
  key: string;
  label: string;
  count: number;
  entities: AnalysisEntityLink[];
};

export type ProjectStatistics = {
  totals: {
    itemCount: number;
    eventCount: number;
    relationshipCount: number;
    internalLinkCount: number;
  };
  countsByType: StatisticDatum[];
  countsByTag: StatisticDatum[];
  countsByCentury: StatisticDatum[];
  durationDistribution: StatisticDatum[];
  datePrecision: StatisticDatum[];
  endStatus: StatisticDatum[];
  relationshipTypes: StatisticDatum[];
  completeness: StatisticDatum[];
  creationActivity: Array<{
    date: string;
    itemCount: number;
    eventCount: number;
  }>;
};

export type ProjectAnalysisFilters = {
  query?: string;
  typeIds?: string[];
  tagIds?: string[];
  tagMode?: "and" | "or";
  eventTypeIds?: string[];
  fromOrdinal?: number | null;
  toOrdinal?: number | null;
  hasEvents?: "all" | "yes" | "no";
  approximate?: "all" | "start" | "end" | "any" | "none";
  hasCustomColor?: "all" | "yes" | "no";
  visibility?: "all" | "visible" | "hidden";
};

const DATE_FLOOR = -400_000_000;
const DATE_CEILING = 400_000_000;

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function levenshtein(left: string, right: string) {
  if (!left) return right.length;
  if (!right) return left.length;
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length]!;
}

function similarity(left: string, right: string) {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - levenshtein(left, right) / longest;
}

function hasMarkdownProblem(value: string | null) {
  if (!value) return false;
  const openings = value.match(/\[\[/g)?.length ?? 0;
  const closings = value.match(/\]\]/g)?.length ?? 0;
  const fences = value.match(/```/g)?.length ?? 0;
  return openings !== closings || fences % 2 !== 0;
}

function safeExternalUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function issue(
  kind: QualityIssueKind,
  title: string,
  detail: string,
  entity?: AnalysisEntity,
): AtomicQualityIssue {
  return {
    id: `${kind}:${entity?.entityType ?? "project"}:${entity?.id ?? title}`,
    kind,
    title,
    detail,
    entityType: entity?.entityType,
    entityId: entity?.id,
  };
}

function groupQualityIssues(issues: AtomicQualityIssue[]): QualityIssue[] {
  const grouped = new Map<string, QualityIssue>();
  for (const issue of issues) {
    const groupId = issue.entityId
      ? `entity:${issue.entityType}:${issue.entityId}`
      : issue.masterId
        ? `master:${issue.masterKind}:${issue.masterId}`
        : issue.id;
    const current = grouped.get(groupId);
    if (!current) {
      grouped.set(groupId, {
        id: groupId,
        title: issue.title,
        reasons: [{ kind: issue.kind, detail: issue.detail, count: 1 }],
        entityType: issue.entityType,
        entityId: issue.entityId,
        masterKind: issue.masterKind,
        masterId: issue.masterId,
      });
      continue;
    }
    const matchingReason = current.reasons.find(
      (reason) => reason.kind === issue.kind && reason.detail === issue.detail,
    );
    if (matchingReason) matchingReason.count += 1;
    else
      current.reasons.push({
        kind: issue.kind,
        detail: issue.detail,
        count: 1,
      });
  }
  return [...grouped.values()];
}

function duplicateCandidates(entities: AnalysisEntity[]) {
  const MAX_PAIR_CHECKS = 25_000;
  const MAX_RESULTS = 500;
  const buckets = new Map<string, number[]>();
  function addToBucket(key: string, index: number) {
    if (!key) return;
    buckets.set(key, [...(buckets.get(key) ?? []), index]);
  }
  entities.forEach((entity, index) => {
    const prefix = entity.entityType;
    const names = [
      ...new Set(
        [entity.title, ...entity.aliases].map(normalized).filter(Boolean),
      ),
    ];
    for (const name of names) addToBucket(`${prefix}:name:${name}`, index);
    const title = normalized(entity.title);
    if (title.length >= 2)
      addToBucket(`${prefix}:fuzzy:${title.slice(0, 2)}`, index);
    addToBucket(
      `${prefix}:date-type:${entity.dateStart}:${entity.dateEnd}:${entity.typeId ?? ""}`,
      index,
    );
    if (entity.externalUrl)
      addToBucket(`${prefix}:url:${entity.externalUrl}`, index);
    if (entity.entityType === "timeline_event" && entity.parentIds.length)
      addToBucket(
        `${prefix}:parents:${[...entity.parentIds].sort().join(",")}`,
        index,
      );
  });
  const pairs = new Set<string>();
  for (const indexes of buckets.values()) {
    for (
      let left = 0;
      left < indexes.length && pairs.size < MAX_PAIR_CHECKS;
      left += 1
    ) {
      for (
        let right = left + 1;
        right < indexes.length && pairs.size < MAX_PAIR_CHECKS;
        right += 1
      ) {
        const leftIndex = indexes[left]!;
        const rightIndex = indexes[right]!;
        pairs.add(
          leftIndex < rightIndex
            ? `${leftIndex}:${rightIndex}`
            : `${rightIndex}:${leftIndex}`,
        );
      }
    }
    if (pairs.size >= MAX_PAIR_CHECKS) break;
  }
  const candidates: DuplicateCandidate[] = [];
  for (const pair of pairs) {
    const [leftIndex, rightIndex] = pair.split(":").map(Number) as [
      number,
      number,
    ];
    const left = entities[leftIndex]!;
    const right = entities[rightIndex]!;
    if (left.entityType !== right.entityType) continue;
    const leftNames = [left.title, ...left.aliases]
      .map(normalized)
      .filter(Boolean);
    const rightNames = [right.title, ...right.aliases]
      .map(normalized)
      .filter(Boolean);
    const titleSimilarity = Math.max(
      ...leftNames.flatMap((leftName) =>
        rightNames.map((rightName) => similarity(leftName, rightName)),
      ),
    );
    const sameDate =
      left.dateStart === right.dateStart && left.dateEnd === right.dateEnd;
    const sameType = Boolean(left.typeId && left.typeId === right.typeId);
    const sameParents =
      left.entityType === "timeline_event" &&
      left.parentIds.length > 0 &&
      left.parentIds.length === right.parentIds.length &&
      left.parentIds.every((id) => right.parentIds.includes(id));
    const sameUrl = Boolean(
      left.externalUrl &&
      right.externalUrl &&
      left.externalUrl === right.externalUrl,
    );
    const reasons: string[] = [];
    let score = Math.round(titleSimilarity * 55);
    if (titleSimilarity >= 0.85) reasons.push("名称");
    if (sameDate) {
      score += 20;
      reasons.push("日付");
    }
    if (sameType) {
      score += 10;
      reasons.push("種別");
    }
    if (sameParents) {
      score += 10;
      reasons.push("親");
    }
    if (sameUrl) {
      score += 15;
      reasons.push("外部URL");
    }
    if (score < 60) continue;
    candidates.push({
      left: { id: left.id, entityType: left.entityType, title: left.title },
      right: {
        id: right.id,
        entityType: right.entityType,
        title: right.title,
      },
      score: Math.min(score, 100),
      reasons,
    });
  }
  return candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RESULTS);
}

const MAX_STATISTIC_ENTITY_LINKS = 200;

function entityLink(entity: AnalysisEntity): AnalysisEntityLink {
  return {
    id: entity.id,
    entityType: entity.entityType,
    title: entity.title,
  };
}

function statisticData(
  groups: Map<string, { label: string; entities: AnalysisEntity[] }>,
) {
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      count: group.entities.length,
      entities: group.entities
        .slice(0, MAX_STATISTIC_ENTITY_LINKS)
        .map(entityLink),
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label, "ja"),
    );
}

function groupedEntities(
  entities: AnalysisEntity[],
  keys: (entity: AnalysisEntity) => Array<{ key: string; label: string }>,
) {
  const groups = new Map<
    string,
    { label: string; entities: AnalysisEntity[] }
  >();
  for (const entity of entities) {
    for (const entry of keys(entity)) {
      const group = groups.get(entry.key) ?? {
        label: entry.label,
        entities: [],
      };
      group.entities.push(entity);
      groups.set(entry.key, group);
    }
  }
  return statisticData(groups);
}

function centuryKey(entity: AnalysisEntity) {
  if (Math.abs(entity.dateStart) >= DATE_CEILING) return null;
  const date = historicalDateFromOrdinal(entity.dateStart);
  const century = Math.floor((date.year - 1) / 100) + 1;
  return {
    key: `${date.era === "bce" ? "bce" : "ce"}:${century}`,
    label: `${date.era === "bce" ? "紀元前" : ""}${century}世紀`,
  };
}

function durationGroup(entity: AnalysisEntity) {
  if (
    entity.entityType !== "timeline_item" ||
    entity.dateEnd >= DATE_CEILING ||
    entity.dateStart <= DATE_FLOOR ||
    entity.dateEnd <= entity.dateStart
  )
    return null;
  const years = (entity.dateEnd - entity.dateStart) / 365.2425;
  if (years < 1) return { key: "under-1", label: "1年未満" };
  if (years < 10) return { key: "1-9", label: "1〜9年" };
  if (years < 25) return { key: "10-24", label: "10〜24年" };
  if (years < 50) return { key: "25-49", label: "25〜49年" };
  if (years < 100) return { key: "50-99", label: "50〜99年" };
  return { key: "100-plus", label: "100年以上" };
}

function filterAnalysisEntities(
  dataset: ProjectAnalysisDataset,
  filters: ProjectAnalysisFilters,
) {
  const normalizedQuery = filters.query?.trim().toLocaleLowerCase("ja") ?? "";
  const eventsByParent = new Map<string, AnalysisEntity[]>();
  for (const event of dataset.entities.filter(
    (entity) => entity.entityType === "timeline_event",
  )) {
    for (const parentId of event.parentIds) {
      const events = eventsByParent.get(parentId) ?? [];
      events.push(event);
      eventsByParent.set(parentId, events);
    }
  }
  const directMatch = (entity: AnalysisEntity) => {
    const tags = new Set(entity.tagIds);
    const tagMatches =
      !filters.tagIds?.length ||
      (filters.tagMode === "and"
        ? filters.tagIds.every((id) => tags.has(id))
        : filters.tagIds.some((id) => tags.has(id)));
    const typeMatches =
      entity.entityType === "timeline_item"
        ? !filters.typeIds?.length ||
          Boolean(entity.typeId && filters.typeIds.includes(entity.typeId))
        : !filters.eventTypeIds?.length ||
          Boolean(
            entity.typeId && filters.eventTypeIds.includes(entity.typeId),
          );
    const queryMatches =
      !normalizedQuery ||
      [entity.title, ...entity.aliases, entity.description ?? ""].some(
        (value) => value.toLocaleLowerCase("ja").includes(normalizedQuery),
      );
    const rangeMatches =
      (filters.fromOrdinal == null || entity.dateEnd >= filters.fromOrdinal) &&
      (filters.toOrdinal == null || entity.dateStart <= filters.toOrdinal);
    const approximateStart = Boolean(entity.isStartApproximate);
    const approximateEnd = Boolean(entity.isEndApproximate);
    const approximateMatches =
      !filters.approximate ||
      filters.approximate === "all" ||
      (filters.approximate === "start" && approximateStart) ||
      (filters.approximate === "end" && approximateEnd) ||
      (filters.approximate === "any" && (approximateStart || approximateEnd)) ||
      (filters.approximate === "none" && !approximateStart && !approximateEnd);
    const colorMatches =
      !filters.hasCustomColor ||
      filters.hasCustomColor === "all" ||
      (filters.hasCustomColor === "yes" && entity.hasCustomColor) ||
      (filters.hasCustomColor === "no" && !entity.hasCustomColor);
    const visibilityMatches =
      !filters.visibility ||
      filters.visibility === "all" ||
      (filters.visibility === "visible" && entity.isVisible !== false) ||
      (filters.visibility === "hidden" && entity.isVisible === false);
    return (
      tagMatches &&
      typeMatches &&
      queryMatches &&
      rangeMatches &&
      approximateMatches &&
      colorMatches &&
      visibilityMatches
    );
  };
  const itemIds = new Set(
    dataset.entities
      .filter((entity) => {
        if (entity.entityType !== "timeline_item" || !directMatch(entity))
          return false;
        const childEvents = eventsByParent.get(entity.id) ?? [];
        return (
          !filters.hasEvents ||
          filters.hasEvents === "all" ||
          (filters.hasEvents === "yes" && childEvents.length > 0) ||
          (filters.hasEvents === "no" && childEvents.length === 0)
        );
      })
      .map((entity) => entity.id),
  );
  return dataset.entities.filter((entity) =>
    entity.entityType === "timeline_item"
      ? itemIds.has(entity.id)
      : directMatch(entity) &&
        (entity.parentIds.length === 0 ||
          entity.parentIds.some((id) => itemIds.has(id))),
  );
}

export function calculateProjectStatistics(
  dataset: ProjectAnalysisDataset,
  filters: ProjectAnalysisFilters = {},
  now = new Date(),
): ProjectStatistics {
  const entities = filterAnalysisEntities(dataset, filters);
  const entitiesById = new Map(
    entities.map((entity) => [`${entity.entityType}:${entity.id}`, entity]),
  );
  const included = new Set(
    entities.map((entity) => `${entity.entityType}:${entity.id}`),
  );
  const masters = new Map(
    dataset.masters.map((master) => [master.id, master.name]),
  );
  const references = dataset.references.filter((reference) =>
    included.has(`${reference.sourceType}:${reference.sourceId}`),
  );
  const relationships = references.filter(
    (reference) => reference.kind === "relationship",
  );
  const internalLinks = references.filter(
    (reference) => reference.kind === "internal_link",
  );
  const items = entities.filter(
    (entity) => entity.entityType === "timeline_item",
  );
  const events = entities.filter(
    (entity) => entity.entityType === "timeline_event",
  );
  const parentIdsWithEvents = new Set(
    events.flatMap((event) => event.parentIds),
  );
  const byType = groupedEntities(entities, (entity) => [
    {
      key: entity.typeId ?? `${entity.entityType}:none`,
      label: entity.typeId
        ? (masters.get(entity.typeId) ?? "不明な種別")
        : "種別なし",
    },
  ]);
  const byTag = groupedEntities(entities, (entity) =>
    entity.tagIds.length
      ? entity.tagIds.map((tagId) => ({
          key: tagId,
          label: masters.get(tagId) ?? "不明なタグ",
        }))
      : [{ key: `${entity.entityType}:untagged`, label: "タグなし" }],
  );
  const completenessDefinitions: Array<[string, string, AnalysisEntity[]]> = [
    [
      "items-without-events",
      "イベントを持たないアイテム",
      items.filter((item) => !parentIdsWithEvents.has(item.id)),
    ],
    [
      "multiple-parent-events",
      "複数親イベント",
      events.filter((event) => event.parentIds.length > 1),
    ],
    [
      "approximate-dates",
      "曖昧日付",
      entities.filter(
        (entity) => entity.isStartApproximate || entity.isEndApproximate,
      ),
    ],
    [
      "missing-description",
      "本文未入力",
      entities.filter((entity) => !entity.description?.trim()),
    ],
    [
      "missing-source",
      "出典未入力",
      entities.filter((entity) => entity.sourceMissing),
    ],
    [
      "broken-links",
      "リンク切れ",
      entities.filter((entity) =>
        internalLinks.some(
          (link) =>
            link.sourceId === entity.id &&
            link.sourceType === entity.entityType &&
            link.targetState !== "active",
        ),
      ),
    ],
  ];
  const endStatusLabels = {
    specified: "終了日指定",
    ongoing: "継続中",
    unknown: "終了時期不明",
  } as const;
  const precisionLabels = {
    day: "年月日",
    month: "年月",
    year: "年",
    decade: "年代",
    century: "世紀",
  } as const;
  const activityEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const activityStart = new Date(activityEnd);
  activityStart.setUTCDate(activityStart.getUTCDate() - 364);
  const activity = new Map<string, { itemCount: number; eventCount: number }>();
  for (
    let date = new Date(activityStart);
    date <= activityEnd;
    date.setUTCDate(date.getUTCDate() + 1)
  )
    activity.set(date.toISOString().slice(0, 10), {
      itemCount: 0,
      eventCount: 0,
    });
  for (const entity of entities) {
    const date = entity.createdAt?.slice(0, 10);
    const point = date ? activity.get(date) : undefined;
    if (!point) continue;
    if (entity.entityType === "timeline_item") point.itemCount += 1;
    else point.eventCount += 1;
  }
  return {
    totals: {
      itemCount: items.length,
      eventCount: events.length,
      relationshipCount: relationships.length,
      internalLinkCount: internalLinks.length,
    },
    countsByType: byType,
    countsByTag: byTag,
    countsByCentury: groupedEntities(entities, (entity) => {
      const century = centuryKey(entity);
      return century ? [century] : [];
    }),
    durationDistribution: groupedEntities(items, (entity) => {
      const group = durationGroup(entity);
      return group ? [group] : [];
    }),
    datePrecision: groupedEntities(entities, (entity) => {
      const precision = entity.datePrecision ?? "year";
      return [{ key: precision, label: precisionLabels[precision] }];
    }),
    endStatus: groupedEntities(items, (entity) => {
      if (!entity.endDateStatus) return [];
      return [
        {
          key: entity.endDateStatus,
          label: endStatusLabels[entity.endDateStatus],
        },
      ];
    }),
    relationshipTypes: statisticData(
      relationships.reduce((groups, reference) => {
        const key = reference.relationType?.trim() || "未分類";
        const source = entitiesById.get(
          `${reference.sourceType}:${reference.sourceId}`,
        );
        const group = groups.get(key) ?? { label: key, entities: [] };
        if (source) group.entities.push(source);
        groups.set(key, group);
        return groups;
      }, new Map<string, { label: string; entities: AnalysisEntity[] }>()),
    ),
    completeness: completenessDefinitions.map(([key, label, values]) => ({
      key,
      label,
      count: values.length,
      entities: values.slice(0, MAX_STATISTIC_ENTITY_LINKS).map(entityLink),
    })),
    creationActivity: [...activity.entries()].map(([date, counts]) => ({
      date,
      ...counts,
    })),
  };
}

export function analyzeProjectData(
  dataset: ProjectAnalysisDataset,
  filters: ProjectAnalysisFilters = {},
) {
  const issues: AtomicQualityIssue[] = [];
  const activeById = new Map(
    dataset.entities.map((entity) => [
      `${entity.entityType}:${entity.id}`,
      entity,
    ]),
  );
  for (const entity of dataset.entities) {
    if (
      entity.entityType === "timeline_event" &&
      entity.parentIds.length === 0
    ) {
      issues.push(
        issue("orphan_event", entity.title, "親が設定されていません。", entity),
      );
    }
    if (entity.entityType === "timeline_event" && entity.parentIds.length > 0) {
      const parents = entity.parentIds
        .map((id) => activeById.get(`timeline_item:${id}`))
        .filter((parent): parent is AnalysisEntity => Boolean(parent));
      if (
        parents.length > 0 &&
        parents.every(
          (parent) =>
            entity.dateEnd < parent.dateStart ||
            entity.dateStart > parent.dateEnd,
        )
      ) {
        issues.push(
          issue(
            "event_outside_all_parents",
            entity.title,
            "イベント日がすべての親の期間外です。",
            entity,
          ),
        );
      }
    }
    if (entity.sourceMissing)
      issues.push(
        issue("missing_source", entity.title, "出典がありません。", entity),
      );
    if (!entity.description?.trim())
      issues.push(
        issue(
          "missing_description",
          entity.title,
          "本文がありません。",
          entity,
        ),
      );
    const missingFields = entity.requiredFieldIds.filter(
      (fieldId) => !entity.filledFieldIds.includes(fieldId),
    );
    if (missingFields.length)
      issues.push(
        issue(
          "missing_required_custom_field",
          entity.title,
          `必須カスタムフィールドが${missingFields.length}件未入力です。`,
          entity,
        ),
      );
    if (!safeExternalUrl(entity.externalUrl))
      issues.push(
        issue(
          "invalid_external_url",
          entity.title,
          "外部URLが不正です。",
          entity,
        ),
      );
    if (hasMarkdownProblem(entity.description))
      issues.push(
        issue(
          "markdown_syntax",
          entity.title,
          "Markdown記法を確認してください。",
          entity,
        ),
      );
  }
  for (const reference of dataset.references) {
    if (reference.targetState === "active") continue;
    const source = activeById.get(
      `${reference.sourceType}:${reference.sourceId}`,
    );
    if (!source) continue;
    const kind =
      reference.kind === "relationship"
        ? "orphan_relationship"
        : reference.targetState === "deleted"
          ? "deleted_reference"
          : "broken_internal_link";
    issues.push(
      issue(
        kind,
        source.title,
        reference.targetState === "deleted"
          ? "削除済みデータを参照しています。"
          : "参照先が見つかりません。",
        source,
      ),
    );
  }
  for (const master of dataset.masters.filter(
    (entry) => entry.usageCount === 0,
  )) {
    issues.push({
      id: `unused_master:${master.kind}:${master.id}`,
      kind: "unused_master",
      title: master.name,
      detail: "未使用のマスタです。",
      masterKind: master.kind,
      masterId: master.id,
    });
  }
  const countsByType: Record<string, number> = {};
  const countsByTag: Record<string, number> = {};
  for (const entity of dataset.entities) {
    if (entity.typeId)
      countsByType[entity.typeId] = (countsByType[entity.typeId] ?? 0) + 1;
    for (const tagId of entity.tagIds)
      countsByTag[tagId] = (countsByTag[tagId] ?? 0) + 1;
  }
  const summary: ProjectAnalysisSummary = {
    itemCount: dataset.entities.filter(
      (entity) => entity.entityType === "timeline_item",
    ).length,
    eventCount: dataset.entities.filter(
      (entity) => entity.entityType === "timeline_event",
    ).length,
    missingSourceCount: dataset.entities.filter(
      (entity) => entity.sourceMissing,
    ).length,
    missingDescriptionCount: dataset.entities.filter(
      (entity) => !entity.description?.trim(),
    ).length,
    brokenLinkCount: dataset.references.filter(
      (reference) => reference.targetState !== "active",
    ).length,
    multipleParentEventCount: dataset.entities.filter(
      (entity) =>
        entity.entityType === "timeline_event" && entity.parentIds.length > 1,
    ).length,
    countsByType,
    countsByTag,
  };
  return {
    issues: groupQualityIssues(issues),
    duplicates: duplicateCandidates(dataset.entities),
    summary,
    statistics: calculateProjectStatistics(dataset, filters),
  };
}
