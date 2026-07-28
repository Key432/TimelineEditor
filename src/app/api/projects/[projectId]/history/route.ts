import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { HistoryService } from "@/lib/services/history-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const search = new URL(request.url).searchParams;
    const history = await new HistoryService(await createClient()).list(
      projectId,
      search.get("entityType"),
      search.get("entityId"),
    );
    return NextResponse.json({ history });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const input = await request.json().catch(() => null);
    const history = await new HistoryService(await createClient()).checkpoint(
      projectId,
      input,
    );
    return NextResponse.json({ history }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
