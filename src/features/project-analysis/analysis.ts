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

export function analyzeProjectData(dataset: ProjectAnalysisDataset) {
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
  };
}
