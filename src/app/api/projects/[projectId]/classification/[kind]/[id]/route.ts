import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ClassificationService } from "@/lib/services/classification-service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProjectById } from "@/lib/public-revalidation";

type Context = {
  params: Promise<{ projectId: string; kind: string; id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { projectId, kind, id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      values?: unknown;
      targetId?: string;
    } | null;
    const client = await createClient();
    const service = new ClassificationService(client);
    if (kind === "tags" && body?.targetId) {
      await service.mergeTags(projectId, id, body.targetId);
      await revalidatePublicProjectById(client, projectId);
      return NextResponse.json({ ok: true });
    }
    let result: Record<string, unknown> | null = null;
    if (kind === "tags")
      result = { tag: await service.updateTag(projectId, id, body?.values) };
    if (kind === "event-types")
      result = {
        eventType: await service.updateEventType(projectId, id, body?.values),
      };
    if (kind === "custom-fields")
      result = {
        customField: await service.updateDefinition(
          projectId,
          id,
          body?.values,
        ),
      };
    if (result) {
      await revalidatePublicProjectById(client, projectId);
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { error: { message: "分類種別が不正です。" } },
      { status: 400 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { projectId, kind, id } = await context.params;
    const client = await createClient();
    const service = new ClassificationService(client);
    if (kind === "tags")
      await service.deleteTag(
        projectId,
        id,
        new URL(request.url).searchParams.get("unusedOnly") === "true",
      );
    else if (kind === "event-types")
      await service.deleteEventType(projectId, id);
    else if (kind === "custom-fields")
      await service.deleteDefinition(projectId, id);
    else
      return NextResponse.json(
        { error: { message: "分類種別が不正です。" } },
        { status: 400 },
      );
    await revalidatePublicProjectById(client, projectId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
