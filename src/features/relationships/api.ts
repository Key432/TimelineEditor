import type {
  EntityRelationship,
  RelationshipCreationFailure,
  RelationshipDataset,
  RelationshipDraft,
  RelationshipEntityType,
} from "@/features/relationships/types";
import type { relationshipInputSchema } from "@/features/relationships/validation";
import type { z } from "zod";
import { requestJson } from "@/lib/api-client";

export const relationshipKeys = {
  all: (projectId: string) => ["relationships", projectId] as const,
};

export async function listRelationships(projectId: string) {
  const result = await requestJson<{ dataset: RelationshipDataset }>(
    `/api/projects/${projectId}/relationships`,
    undefined,
    "関係性を更新できませんでした。",
  );
  return result.dataset;
}

export async function createRelationship(
  projectId: string,
  input: z.input<typeof relationshipInputSchema>,
) {
  const result = await requestJson<{ relationship: EntityRelationship }>(
    `/api/projects/${projectId}/relationships`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "関係性を更新できませんでした。",
  );
  return result.relationship;
}

export async function updateRelationship(
  projectId: string,
  relationshipId: string,
  input: z.input<typeof relationshipInputSchema>,
) {
  const result = await requestJson<{ relationship: EntityRelationship }>(
    `/api/projects/${projectId}/relationships/${relationshipId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "関係性を更新できませんでした。",
  );
  return result.relationship;
}

export async function deleteRelationship(
  projectId: string,
  relationshipId: string,
) {
  await requestJson<void>(
    `/api/projects/${projectId}/relationships/${relationshipId}`,
    { method: "DELETE" },
    "関係性を更新できませんでした。",
  );
}

export async function createDraftRelationships(
  projectId: string,
  sourceType: RelationshipEntityType,
  sourceId: string,
  drafts: RelationshipDraft[],
): Promise<RelationshipCreationFailure[]> {
  const results = await Promise.allSettled(
    drafts.map((draft) =>
      createRelationship(projectId, { sourceType, sourceId, ...draft }),
    ),
  );
  return results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            label: drafts[index]?.relationType ?? "関係性",
            reason:
              result.reason instanceof Error
                ? result.reason.message
                : "関係性を追加できませんでした。",
          },
        ]
      : [],
  );
}
