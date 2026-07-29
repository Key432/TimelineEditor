import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { CloudDraftService } from "@/lib/services/cloud-draft-service";
import { createClient } from "@/lib/supabase/server";

type Context = {
  params: Promise<{
    projectId: string;
    entityType: string;
    draftScope: string;
  }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId, entityType, draftScope } = await context.params;
    return NextResponse.json({
      draft: await new CloudDraftService(await createClient()).get(
        projectId,
        entityType,
        draftScope,
      ),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { projectId, entityType, draftScope } = await context.params;
    const input = await request.json().catch(() => null);
    return NextResponse.json({
      draft: await new CloudDraftService(await createClient()).save(
        projectId,
        entityType,
        draftScope,
        input,
      ),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { projectId, entityType, draftScope } = await context.params;
    await new CloudDraftService(await createClient()).delete(
      projectId,
      entityType,
      draftScope,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
