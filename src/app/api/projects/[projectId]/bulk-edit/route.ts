import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { BulkEditService } from "@/lib/services/bulk-edit-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const result = await new BulkEditService(await createClient()).execute(
      projectId,
      await request.json(),
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const result = await new BulkEditService(await createClient()).undo(
      projectId,
      await request.json(),
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
