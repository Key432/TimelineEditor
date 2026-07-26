import { apiErrorResponse } from "@/lib/api-response";
import { ImportExportService } from "@/lib/services/import-export-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { archive, fileName } = await new ImportExportService(
      await createClient(),
    ).exportCsv(projectId);
    return new Response(archive, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="timeline_${new Date().toISOString().slice(0, 10)}.zip"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
