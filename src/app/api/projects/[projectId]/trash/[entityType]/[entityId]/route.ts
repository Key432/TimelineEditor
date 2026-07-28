import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { HistoryService } from "@/lib/services/history-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
    entityType: string;
    entityId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, entityType, entityId } = await context.params;
    await new HistoryService(await createClient()).purgeTrash(
      projectId,
      entityType,
      entityId,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
