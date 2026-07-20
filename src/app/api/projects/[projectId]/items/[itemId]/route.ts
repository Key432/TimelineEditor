import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; itemId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, itemId } = await context.params;
    const result = await new TimelineItemService(await createClient()).get(
      projectId,
      itemId,
    );
    return NextResponse.json({ item: result.item });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, itemId } = await context.params;
    const input = await request.json().catch(() => null);
    const service = new TimelineItemService(await createClient());
    if (typeof input === "object" && input !== null && "manualOrder" in input) {
      const items = await service.move(projectId, itemId, input);
      return NextResponse.json({ items });
    }
    const item = await service.update(projectId, itemId, input);
    return NextResponse.json({ item });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, itemId } = await context.params;
    await new TimelineItemService(await createClient()).delete(
      projectId,
      itemId,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
