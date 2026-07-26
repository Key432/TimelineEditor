import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ImportExportService } from "@/lib/services/import-export-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    return NextResponse.json(
      await new ImportExportService(await createClient()).commitNew(
        await request.json(),
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
