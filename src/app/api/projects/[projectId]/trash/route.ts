import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { HistoryService } from "@/lib/services/history-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const trash = await new HistoryService(await createClient()).listTrash(
      projectId,
    );
    return NextResponse.json({ trash });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
