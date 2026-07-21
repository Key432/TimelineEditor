import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const events = await new TimelineEventService(await createClient()).list(
      projectId,
    );
    return NextResponse.json({ events });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const input = await request.json().catch(() => null);
    const event = await new TimelineEventService(await createClient()).create(
      projectId,
      input,
    );
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
