import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { SearchService } from "@/lib/services/search-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const result = await new SearchService(await createClient()).timeline(
      projectId,
      { q: new URL(request.url).searchParams.get("q") },
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
