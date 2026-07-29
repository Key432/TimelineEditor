import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";
import { ImportExportService } from "@/lib/services/import-export-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const client = await createClient();
    const result = await new ImportExportService(client).commit(
      projectId,
      await request.json(),
      "csv",
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
