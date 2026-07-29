import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ClassificationService } from "@/lib/services/classification-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json(
      await new ClassificationService(await createClient()).list(projectId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      kind?: string;
      values?: unknown;
    } | null;
    const client = await createClient();
    const service = new ClassificationService(client);
    let result: Record<string, unknown> | null = null;
    if (body?.kind === "tag")
      result = { tag: await service.createTag(projectId, body.values) };
    if (body?.kind === "eventType")
      result = {
        eventType: await service.createEventType(projectId, body.values),
      };
    if (body?.kind === "customField")
      result = {
        customField: await service.createDefinition(projectId, body.values),
      };
    if (result) {
      await revalidatePublicProjectById(client, projectId);
      return NextResponse.json(result, { status: 201 });
    }
    return NextResponse.json(
      { error: { message: "分類種別を指定してください。" } },
      { status: 400 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
