import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { ClassificationService } from "@/lib/services/classification-service";
import { createClient } from "@/lib/supabase/server";

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
    const service = new ClassificationService(await createClient());
    if (kind === "tags" && body?.targetId) {
      await service.mergeTags(projectId, id, body.targetId);
      return NextResponse.json({ ok: true });
    }
    if (kind === "tags")
      return NextResponse.json({
        tag: await service.updateTag(projectId, id, body?.values),
      });
    if (kind === "event-types")
      return NextResponse.json({
        eventType: await service.updateEventType(projectId, id, body?.values),
      });
    if (kind === "custom-fields")
      return NextResponse.json({
        customField: await service.updateDefinition(
          projectId,
          id,
          body?.values,
        ),
      });
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
    const service = new ClassificationService(await createClient());
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
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
