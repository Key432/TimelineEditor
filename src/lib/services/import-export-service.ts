import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  csvArchiveFileName,
  createCsvArchive,
  parseCsvImport,
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
  mode: z.enum(["create", "duplicate", "overwrite", "append"]),
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
    const backup = await this.exportJson(projectId);
    return {
      archive: createCsvArchive(backup),
      fileName: csvArchiveFileName(backup.project.name),
    };
  }

  async previewJson(projectId: string, input: unknown) {
    await this.requireProject(projectId);
    return previewBackup(input);
  }

  async previewCsv(projectId: string, input: Uint8Array, fileName: string) {
    await this.requireProject(projectId);
    const backup = await this.repository.export(projectId);
    if (!backup)
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    return parseCsvImport(input, fileName, backup);
  }

  previewNewJson(input: unknown) {
    return previewBackup(input);
  }

  previewNewCsv(input: Uint8Array, fileName: string) {
    const projectName =
      fileName.replace(/_\d{4}-\d{2}-\d{2}\.zip$/, "").trim() ||
      "インポートしたプロジェクト";
    const currentYear = new Date().getUTCFullYear();
    return parseCsvImport(input, fileName, {
      schemaVersion: 1,
      appVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      project: {
        id: crypto.randomUUID(),
        name: projectName,
        description: null,
        visibility: "private",
        publicId: null,
        publishedAt: null,
      },
      settings: {
        defaultUncertaintyYears: 0,
        initialStartYear: currentYear - 100,
        initialEndYear: currentYear,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "year",
      },
      itemTypes: [],
      timelineItems: [],
      timelineEvents: [],
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

  async commitNew(input: unknown) {
    const parsed = commitSchema.safeParse(input);
    if (!parsed.success || parsed.data.mode !== "create")
      throw new ServiceError(
        "インポート内容を確認してください。",
        400,
        "VALIDATION_ERROR",
        parsed.success ? undefined : z.flattenError(parsed.error),
      );
    const projectId = await this.repository.import(
      null,
      "create",
      parsed.data.payload,
    );
    return {
      projectId,
      imported: {
        itemTypes: parsed.data.payload.itemTypes.length,
        timelineItems: parsed.data.payload.timelineItems.length,
        timelineEvents: parsed.data.payload.timelineEvents.length,
      },
    };
  }
}
