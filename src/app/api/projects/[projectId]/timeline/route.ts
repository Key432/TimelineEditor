import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const result = await new TimelineItemService(await createClient()).list(
      projectId,
    );
    return NextResponse.json({ items: result.items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
