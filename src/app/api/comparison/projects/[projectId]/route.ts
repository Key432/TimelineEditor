import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ComparisonService } from "@/lib/services/comparison-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const params = new URL(request.url).searchParams;
    const dataset = await new ComparisonService(
      await createClient(),
    ).loadProject(projectId, {
      from: params.get("from"),
      to: params.get("to"),
    });
    return NextResponse.json({ dataset });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
