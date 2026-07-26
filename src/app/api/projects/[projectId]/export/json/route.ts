import { apiErrorResponse } from "@/lib/api-response";
import { jsonExportFileName } from "@/features/import-export/csv";
import { ImportExportService } from "@/lib/services/import-export-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const backup = await new ImportExportService(
      await createClient(),
    ).exportJson(projectId);
    const fileName = jsonExportFileName(backup.project.name);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="timeline_${new Date().toISOString().slice(0, 10)}.json"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
