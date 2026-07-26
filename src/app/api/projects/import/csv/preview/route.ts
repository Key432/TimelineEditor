import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ServiceError } from "@/lib/services/errors";
import { ImportExportService } from "@/lib/services/import-export-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size > 25_000_000 ||
      !file.name.endsWith(".zip")
    )
      throw new ServiceError(
        "25MB以下のCSV ZIPファイルを選択してください。",
        400,
        "VALIDATION_ERROR",
      );
    return NextResponse.json(
      new ImportExportService(await createClient()).previewNewCsv(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
