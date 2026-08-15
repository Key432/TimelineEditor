import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ProjectAnalysisService } from "@/lib/services/project-analysis-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json(
      await new ProjectAnalysisService(await createClient()).analyze(
        projectId,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json(
      await new ProjectAnalysisService(await createClient()).merge(
        projectId,
        await request.json(),
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json(
      await new ProjectAnalysisService(await createClient()).undo(
        projectId,
        await request.json(),
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
