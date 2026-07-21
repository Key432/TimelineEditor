import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string; eventId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, eventId } = await context.params;
    const { event } = await new TimelineEventService(await createClient()).get(
      projectId,
      eventId,
    );
    return NextResponse.json({ event });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, eventId } = await context.params;
    const input = await request.json().catch(() => null);
    const event = await new TimelineEventService(await createClient()).update(
      projectId,
      eventId,
      input,
    );
    return NextResponse.json({ event });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, eventId } = await context.params;
    await new TimelineEventService(await createClient()).delete(
      projectId,
      eventId,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
