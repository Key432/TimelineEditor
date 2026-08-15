import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ComparisonService } from "@/lib/services/comparison-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ viewId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { viewId } = await context.params;
    const view = await new ComparisonService(
      await createClient(),
    ).updateSavedView(viewId, await request.json().catch(() => null));
    return NextResponse.json({ view });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { viewId } = await context.params;
    await new ComparisonService(await createClient()).deleteSavedView(viewId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
