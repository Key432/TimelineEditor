import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const input = await request.json().catch(() => null);
    const result = await new TimelineItemService(await createClient()).create(
      projectId,
      input,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
