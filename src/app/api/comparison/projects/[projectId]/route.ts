import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ComparisonService } from "@/lib/services/comparison-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const dataset = await new ComparisonService(
      await createClient(),
    ).loadProject(projectId);
    return NextResponse.json({ dataset });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
