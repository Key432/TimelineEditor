import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ItemTypeService } from "@/lib/services/item-type-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; typeId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, typeId } = await context.params;
    const input = await request.json().catch(() => null);
    const itemType = await new ItemTypeService(await createClient()).update(
      projectId,
      typeId,
      input,
    );
    return NextResponse.json({ itemType });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, typeId } = await context.params;
    await new ItemTypeService(await createClient()).delete(projectId, typeId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
