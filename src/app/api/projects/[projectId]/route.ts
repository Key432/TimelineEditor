import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProject } from "@/lib/public-revalidation";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const service = new ProjectService(await createClient());
    return NextResponse.json({ project: await service.get(projectId) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const service = new ProjectService(await createClient());
    const input = await request.json().catch(() => null);
    const project = await service.update(projectId, input);
    revalidatePublicProject(project);
    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const service = new ProjectService(await createClient());
    const input = await request.json().catch(() => null);
    await service.delete(projectId, input);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
