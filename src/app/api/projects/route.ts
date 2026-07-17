import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const service = new ProjectService(await createClient());
    return NextResponse.json({ projects: await service.list() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const service = new ProjectService(await createClient());
    const input = await request.json().catch(() => null);
    const project = await service.create(input);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
