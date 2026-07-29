import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";
import { HistoryService } from "@/lib/services/history-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; historyId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { projectId, historyId } = await context.params;
    const client = await createClient();
    await new HistoryService(client).restoreHistory(projectId, historyId);
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ restored: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
