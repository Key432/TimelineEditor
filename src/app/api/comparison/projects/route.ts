import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ComparisonService } from "@/lib/services/comparison-service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const projects = await new ComparisonService(
      await createClient(),
    ).listProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
