import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { ImportExportService } from "@/lib/services/import-export-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    return NextResponse.json(
      await new ImportExportService(await createClient()).commit(
        projectId,
        await request.json(),
        "json",
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
