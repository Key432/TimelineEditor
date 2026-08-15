import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ComparisonRepository } from "@/lib/repositories/comparison-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import type { Database } from "@/lib/supabase/database.types";

export class ComparisonService {
  private readonly repository: ComparisonRepository;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new ComparisonRepository(client);
  }

  private async userId() {
    const { data, error } = await this.client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || typeof userId !== "string")
      throw new ServiceError("認証が必要です。", 401, "UNAUTHENTICATED");
    return userId;
  }

  async listProjects() {
    return this.repository.listProjects(await this.userId());
  }

  async loadProject(projectId: string) {
    const userId = await this.userId();
    if (!z.uuid().safeParse(projectId).success)
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    const project = await new ProjectService(this.client).get(projectId);
    const [listing, events, ownerId] = await Promise.all([
      new TimelineItemService(this.client).list(project.id),
      new TimelineEventService(this.client).list(project.id),
      this.repository.ownerId(project.id),
    ]);
    return {
      project,
      access: userId === ownerId ? ("owned" as const) : ("public" as const),
      items: listing.items,
      events,
      itemTypes: listing.itemTypes,
    };
  }
}
