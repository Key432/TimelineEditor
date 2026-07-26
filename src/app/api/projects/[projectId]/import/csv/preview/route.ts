import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { ImportExportService } from "@/lib/services/import-export-service";
import { ServiceError } from "@/lib/services/errors";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || file.size > 25_000_000)
      throw new ServiceError(
        "25MB以下のZIPファイルを選択してください。",
        400,
        "VALIDATION_ERROR",
      );
    return NextResponse.json(
      await new ImportExportService(await createClient()).previewCsv(
        projectId,
        new Uint8Array(await file.arrayBuffer()),
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
