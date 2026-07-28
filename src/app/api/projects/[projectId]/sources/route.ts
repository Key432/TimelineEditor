import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { SourceService } from "@/lib/services/source-service";
import { createClient } from "@/lib/supabase/server";

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
    const source = await new SourceService(await createClient()).create(
      projectId,
      input,
    );
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
