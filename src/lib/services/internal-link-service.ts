import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { InternalLinkRepository } from "@/lib/repositories/internal-link-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import type { Database } from "@/lib/supabase/database.types";

const idsSchema = z.array(z.uuid()).max(100);

function validationError(error: z.ZodError) {
  return new ServiceError(
    "入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

export class InternalLinkService {
  private readonly repository: InternalLinkRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new InternalLinkRepository(client);
    this.projects = new ProjectService(client);
  }

  async candidates(projectId: string, query: string) {
    const project = await this.projects.get(projectId);
    return this.repository.candidates(project.id, query.trim().slice(0, 200));
  }

  async resolve(projectId: string, itemIds: string[], eventIds: string[]) {
    const project = await this.projects.get(projectId);
    const parsed = z
      .object({ itemIds: idsSchema, eventIds: idsSchema })
      .safeParse({ itemIds, eventIds });
    if (!parsed.success) throw validationError(parsed.error);
    return this.repository.resolve(
      project.id,
      parsed.data.itemIds,
      parsed.data.eventIds,
    );
  }

  async referenceCount(
    projectId: string,
    entityType: "item" | "event",
    entityId: string,
  ) {
    const project = await this.projects.get(projectId);
    const parsed = z
      .object({ entityType: z.enum(["item", "event"]), entityId: z.uuid() })
      .safeParse({ entityType, entityId });
    if (!parsed.success) throw validationError(parsed.error);
    return this.repository.referenceCount(
      project.id,
      parsed.data.entityType,
      parsed.data.entityId,
    );
  }
}
