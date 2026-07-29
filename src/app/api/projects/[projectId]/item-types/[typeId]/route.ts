import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ItemTypeService } from "@/lib/services/item-type-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";

type RouteContext = {
  params: Promise<{ projectId: string; typeId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, typeId } = await context.params;
    const input = await request.json().catch(() => null);
    const client = await createClient();
    const itemType = await new ItemTypeService(client).update(
      projectId,
      typeId,
      input,
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ itemType });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, typeId } = await context.params;
    const client = await createClient();
    await new ItemTypeService(client).delete(projectId, typeId);
    await revalidatePublicProjectById(client, projectId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
