import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { SourceService } from "@/lib/services/source-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; sourceId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, sourceId } = await context.params;
    const source = await new SourceService(await createClient()).update(
      projectId,
      sourceId,
      await request.json().catch(() => null),
    );
    return NextResponse.json({ source });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, sourceId } = await context.params;
    await new SourceService(await createClient()).delete(projectId, sourceId);
    return NextResponse.json({});
  } catch (error) {
    return apiErrorResponse(error);
  }
}
