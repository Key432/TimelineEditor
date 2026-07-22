import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  globalSearchSchema,
  timelineSearchSchema,
} from "@/features/search/validation";
import { SearchRepository } from "@/lib/repositories/search-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import type { Database } from "@/lib/supabase/database.types";

function invalidSearch(error: z.ZodError) {
  return new ServiceError(
    "検索条件を確認してください。",
    400,
    "INVALID_SEARCH",
    z.flattenError(error),
  );
}

export class SearchService {
  private readonly repository: SearchRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new SearchRepository(client);
    this.projects = new ProjectService(client);
  }

  async global(input: unknown) {
    const parsed = globalSearchSchema.safeParse(input);
    if (!parsed.success) throw invalidSearch(parsed.error);
    const result = await this.repository.global({
      query: parsed.data.q,
      entityType: parsed.data.type,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return {
      ...result,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    };
  }

  async timeline(projectId: string, input: unknown) {
    const parsed = timelineSearchSchema.safeParse(input);
    if (!parsed.success) throw invalidSearch(parsed.error);
    const project = await this.projects.get(projectId);
    return this.repository.timeline(project.id, parsed.data.q);
  }
}
