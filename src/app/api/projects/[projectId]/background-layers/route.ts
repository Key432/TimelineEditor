import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";
import { BackgroundLayerService } from "@/lib/services/background-layer-service";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json({
      layers: await new BackgroundLayerService(await createClient()).list(
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
    const client = await createClient();
    const layer = await new BackgroundLayerService(client).createLayer(
      projectId,
      await request.json().catch(() => null),
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ layer }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
