import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";
import { RelationshipService } from "@/lib/services/relationship-service";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json({
      dataset: await new RelationshipService(await createClient()).list(
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
    const relationship = await new RelationshipService(client).create(
      projectId,
      await request.json().catch(() => null),
    );
    await revalidatePublicProjectById(client, projectId);
    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
