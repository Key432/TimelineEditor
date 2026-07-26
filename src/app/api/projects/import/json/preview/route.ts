import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ImportExportService } from "@/lib/services/import-export-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    return NextResponse.json(
      new ImportExportService(await createClient()).previewNewJson(
        await request.json(),
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
