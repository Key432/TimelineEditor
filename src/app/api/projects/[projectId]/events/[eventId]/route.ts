import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProject } from "@/lib/public-revalidation";

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
    const client = await createClient();
    const event = await new TimelineEventService(client).update(
      projectId,
      eventId,
      input,
    );
    revalidatePublicProject(await new ProjectService(client).get(projectId));
    return NextResponse.json({ event });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, eventId } = await context.params;
    const client = await createClient();
    await new TimelineEventService(client).delete(projectId, eventId);
    revalidatePublicProject(await new ProjectService(client).get(projectId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
