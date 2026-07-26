import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  createCsvArchive,
  parseCsvArchive,
} from "@/features/import-export/csv";
import {
  previewBackup,
  projectBackupSchema,
} from "@/features/import-export/schema";
import { ImportExportRepository } from "@/lib/repositories/import-export-repository";
import { ProjectService } from "@/lib/services/project-service";
import { ServiceError } from "@/lib/services/errors";
import type { Database } from "@/lib/supabase/database.types";

const commitSchema = z.object({
  mode: z.enum(["duplicate", "overwrite", "append"]),
  payload: projectBackupSchema,
});

export class ImportExportService {
  private readonly repository: ImportExportRepository;
  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new ImportExportRepository(client);
  }

  private async requireProject(projectId: string) {
    return new ProjectService(this.client).get(projectId);
  }

  async exportJson(projectId: string) {
    await this.requireProject(projectId);
    const backup = await this.repository.export(projectId);
    if (!backup)
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    return backup;
  }

  async exportCsv(projectId: string) {
    return createCsvArchive(await this.exportJson(projectId));
  }

  async previewJson(projectId: string, input: unknown) {
    await this.requireProject(projectId);
    return previewBackup(input);
  }

  async previewCsv(projectId: string, input: Uint8Array) {
    const project = await this.requireProject(projectId);
    return parseCsvArchive(input, {
      appVersion: "0.1.0",
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        visibility: project.visibility,
        publicId: project.publicId,
        publishedAt: project.publishedAt,
      },
      settings: project.settings,
    });
  }

  async commit(projectId: string, input: unknown, format: "json" | "csv") {
    await this.requireProject(projectId);
    const parsed = commitSchema.safeParse(input);
    if (!parsed.success)
      throw new ServiceError(
        "インポート内容を確認してください。",
        400,
        "VALIDATION_ERROR",
        z.flattenError(parsed.error),
      );
    const expected = format === "csv" ? "append" : parsed.data.mode;
    if (format === "csv" && parsed.data.mode !== "append")
      throw new ServiceError(
        "CSVは現在のプロジェクトへ追加してください。",
        400,
        "VALIDATION_ERROR",
      );
    const projectIdResult = await this.repository.import(
      projectId,
      expected,
      parsed.data.payload,
    );
    return {
      projectId: projectIdResult,
      imported: {
        itemTypes: parsed.data.payload.itemTypes.length,
        timelineItems: parsed.data.payload.timelineItems.length,
        timelineEvents: parsed.data.payload.timelineEvents.length,
      },
    };
  }
}
