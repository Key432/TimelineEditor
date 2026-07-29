import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { SourceService } from "@/lib/services/source-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";

type RouteContext = {
  params: Promise<{ projectId: string; sourceId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, sourceId } = await context.params;
    const client = await createClient();
    const source = await new SourceService(client).update(
      projectId,
      sourceId,
      await request.json().catch(() => null),
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ source });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, sourceId } = await context.params;
    const client = await createClient();
    await new SourceService(client).delete(projectId, sourceId);
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({});
  } catch (error) {
    return apiErrorResponse(error);
  }
}
