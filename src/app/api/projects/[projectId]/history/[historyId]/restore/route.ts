import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { HistoryService } from "@/lib/services/history-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; historyId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { projectId, historyId } = await context.params;
    await new HistoryService(await createClient()).restoreHistory(
      projectId,
      historyId,
    );
    return NextResponse.json({ restored: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
