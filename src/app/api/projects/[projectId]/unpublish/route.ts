import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProject } from "@/lib/public-revalidation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const client = await createClient();
    const service = new ProjectService(client);
    const previous = await service.get(projectId);
    const project = await service.unpublish(projectId);
    revalidatePublicProject(previous);
    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
