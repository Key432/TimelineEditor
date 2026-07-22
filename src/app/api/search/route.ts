import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { SearchService } from "@/lib/services/search-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const result = await new SearchService(await createClient()).global({
      q: params.get("q"),
      type: params.get("type") || undefined,
      page: params.get("page") || undefined,
      pageSize: params.get("pageSize") || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
