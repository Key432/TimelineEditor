import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { relationshipInputSchema } from "@/features/relationships/validation";
import { RelationshipRepository } from "@/lib/repositories/relationship-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import type { Database } from "@/lib/supabase/database.types";

function validationError(error: z.ZodError) {
  return new ServiceError(
    "関係性の入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

export class RelationshipService {
  private readonly repository: RelationshipRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new RelationshipRepository(client);
    this.projects = new ProjectService(client);
  }

  private id(value: string) {
    if (!z.uuid().safeParse(value).success)
      throw new ServiceError(
        "関係性が見つかりません。",
        404,
        "RELATIONSHIP_NOT_FOUND",
      );
    return value;
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    return this.repository.list(project.id);
  }

  async create(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = relationshipInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error);
    try {
      return await this.repository.create(project.id, parsed.data);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      )
        throw new ServiceError(
          "同じ種別の関係性がすでに登録されています。",
          409,
          "RELATIONSHIP_CONFLICT",
        );
      throw error;
    }
  }

  async update(projectId: string, relationshipId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = relationshipInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error);
    const relationship = await this.repository.update(
      project.id,
      this.id(relationshipId),
      parsed.data,
    );
    if (!relationship)
      throw new ServiceError(
        "関係性が見つかりません。",
        404,
        "RELATIONSHIP_NOT_FOUND",
      );
    return relationship;
  }

  async delete(projectId: string, relationshipId: string) {
    const project = await this.projects.get(projectId);
    if (!(await this.repository.delete(project.id, this.id(relationshipId))))
      throw new ServiceError(
        "関係性が見つかりません。",
        404,
        "RELATIONSHIP_NOT_FOUND",
      );
  }
}
