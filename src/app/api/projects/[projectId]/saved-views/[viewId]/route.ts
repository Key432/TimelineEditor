import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineSavedViewService } from "@/lib/services/timeline-saved-view-service";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ projectId: string; viewId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { projectId, viewId } = await context.params;
    const input = await request.json().catch(() => null);
    return NextResponse.json({
      view: await new TimelineSavedViewService(await createClient()).update(
        projectId,
        viewId,
        input,
      ),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { projectId, viewId } = await context.params;
    await new TimelineSavedViewService(await createClient()).delete(
      projectId,
      viewId,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
