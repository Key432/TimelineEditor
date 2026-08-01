import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";
import { RelationshipService } from "@/lib/services/relationship-service";
import { createClient } from "@/lib/supabase/server";

type Context = {
  params: Promise<{ projectId: string; relationshipId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const { projectId, relationshipId } = await context.params;
    const client = await createClient();
    const relationship = await new RelationshipService(client).update(
      projectId,
      relationshipId,
      await request.json().catch(() => null),
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ relationship });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { projectId, relationshipId } = await context.params;
    const client = await createClient();
    await new RelationshipService(client).delete(projectId, relationshipId);
    await revalidatePublicProjectById(client, projectId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
