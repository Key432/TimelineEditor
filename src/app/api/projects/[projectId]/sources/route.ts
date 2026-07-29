import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { SourceService } from "@/lib/services/source-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const result = await new SourceService(await createClient()).list(
      projectId,
    );
    return NextResponse.json({
      sources: result.sources,
      missingEntities: result.missingEntities,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const input = await request.json().catch(() => null);
    const client = await createClient();
    const source = await new SourceService(client).create(projectId, input);
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
