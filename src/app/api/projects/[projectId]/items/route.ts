import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProject } from "@/lib/public-revalidation";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const input = await request.json().catch(() => null);
    const client = await createClient();
    const result = await new TimelineItemService(client).create(
      projectId,
      input,
    );
    revalidatePublicProject(await new ProjectService(client).get(projectId));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
