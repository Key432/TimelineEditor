import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";
import { BackgroundLayerService } from "@/lib/services/background-layer-service";
import { createClient } from "@/lib/supabase/server";
type Context = {
  params: Promise<{ projectId: string; layerId: string; periodId: string }>;
};
export async function PUT(request: Request, context: Context) {
  try {
    const { projectId, layerId, periodId } = await context.params;
    const client = await createClient();
    const layer = await new BackgroundLayerService(client).savePeriod(
      projectId,
      layerId,
      periodId,
      await request.json().catch(() => null),
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ layer });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const { projectId, layerId, periodId } = await context.params;
    const client = await createClient();
    await new BackgroundLayerService(client).deletePeriod(
      projectId,
      layerId,
      periodId,
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
