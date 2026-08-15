import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ComparisonService } from "@/lib/services/comparison-service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const views = await new ComparisonService(
      await createClient(),
    ).listSavedViews();
    return NextResponse.json({ views });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const view = await new ComparisonService(
      await createClient(),
    ).createSavedView(await request.json().catch(() => null));
    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
