import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ItemTypeService } from "@/lib/services/item-type-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const result = await new ItemTypeService(await createClient()).list(
      projectId,
    );
    return NextResponse.json({ itemTypes: result.itemTypes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const input = await request.json().catch(() => null);
    const itemType = await new ItemTypeService(await createClient()).create(
      projectId,
      input,
    );
    return NextResponse.json({ itemType }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
