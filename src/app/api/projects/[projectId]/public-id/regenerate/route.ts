import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const project = await new ProjectService(
      await createClient(),
    ).regeneratePublicId(projectId);
    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
