import { z } from "zod";

export const entityTypeSchema = z.enum(["timelineItem", "timelineEvent"]);

export const entityReferenceSchema = z.object({
  type: entityTypeSchema,
  id: z.uuid(),
});

export type EntityType = z.output<typeof entityTypeSchema>;
export type EntityReference = z.output<typeof entityReferenceSchema>;

export type EntityLookupResult<T> =
  | { status: "found"; entity: T }
  | { status: "deleted" | "forbidden" | "missing" };

export type EntityResolution<T> =
  | { status: "resolved"; reference: EntityReference; entity: T }
  | { status: "unavailable"; reference: EntityReference };

export function entityReferenceKey(reference: EntityReference) {
  return `${reference.type}:${reference.id}`;
}

export async function resolveEntityReference<T>(
  reference: EntityReference,
  lookup: (
    reference: EntityReference,
  ) => EntityLookupResult<T> | Promise<EntityLookupResult<T>>,
): Promise<EntityResolution<T>> {
  const parsedReference = entityReferenceSchema.parse(reference);
  const result = await lookup(parsedReference);

  if (result.status === "found") {
    return {
      status: "resolved",
      reference: parsedReference,
      entity: result.entity,
    };
  }

  // Do not reveal whether an inaccessible reference was deleted, never
  // existed, or belongs to a project the caller cannot access.
  return { status: "unavailable", reference: parsedReference };
}

export const UNAVAILABLE_ENTITY_LABEL = "参照先を表示できません";
