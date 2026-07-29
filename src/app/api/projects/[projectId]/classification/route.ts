import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ClassificationService } from "@/lib/services/classification-service";
import { createClient } from "@/lib/supabase/server";

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
    const service = new ClassificationService(await createClient());
    if (body?.kind === "tag")
      return NextResponse.json(
        { tag: await service.createTag(projectId, body.values) },
        { status: 201 },
      );
    if (body?.kind === "eventType")
      return NextResponse.json(
        { eventType: await service.createEventType(projectId, body.values) },
        { status: 201 },
      );
    if (body?.kind === "customField")
      return NextResponse.json(
        { customField: await service.createDefinition(projectId, body.values) },
        { status: 201 },
      );
    return NextResponse.json(
      { error: { message: "分類種別を指定してください。" } },
      { status: 400 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
