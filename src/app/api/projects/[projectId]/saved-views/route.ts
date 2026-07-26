import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineSavedViewService } from "@/lib/services/timeline-saved-view-service";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json({
      views: await new TimelineSavedViewService(await createClient()).list(
        projectId,
      ),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const input = await request.json().catch(() => null);
    return NextResponse.json(
      {
        view: await new TimelineSavedViewService(await createClient()).create(
          projectId,
          input,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
