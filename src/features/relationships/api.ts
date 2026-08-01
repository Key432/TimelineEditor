import type {
  EntityRelationship,
  RelationshipCreationFailure,
  RelationshipDataset,
  RelationshipDraft,
  RelationshipEntityType,
} from "@/features/relationships/types";
import type { relationshipInputSchema } from "@/features/relationships/validation";
import type { z } from "zod";

export const relationshipKeys = {
  all: (projectId: string) => ["relationships", projectId] as const,
};

async function payload<T>(response: Response): Promise<T> {
  const body = (await response.json()) as {
    error?: { message?: string };
  } & T;
  if (!response.ok)
    throw new Error(body.error?.message ?? "関係性を更新できませんでした。");
  return body;
}

export async function listRelationships(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/relationships`);
  return (await payload<{ dataset: RelationshipDataset }>(response)).dataset;
}

export async function createRelationship(
  projectId: string,
  input: z.input<typeof relationshipInputSchema>,
) {
  const response = await fetch(`/api/projects/${projectId}/relationships`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await payload<{ relationship: EntityRelationship }>(response))
    .relationship;
}

export async function updateRelationship(
  projectId: string,
  relationshipId: string,
  input: z.input<typeof relationshipInputSchema>,
) {
  const response = await fetch(
    `/api/projects/${projectId}/relationships/${relationshipId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return (await payload<{ relationship: EntityRelationship }>(response))
    .relationship;
}

export async function deleteRelationship(
  projectId: string,
  relationshipId: string,
) {
  const response = await fetch(
    `/api/projects/${projectId}/relationships/${relationshipId}`,
    { method: "DELETE" },
  );
  if (!response.ok) await payload<Record<string, never>>(response);
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
