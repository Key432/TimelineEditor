import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { InternalLinkService } from "@/lib/services/internal-link-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

function ids(value: string | null) {
  return value ? value.split(",").filter(Boolean) : [];
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const search = new URL(request.url).searchParams;
    const service = new InternalLinkService(await createClient());
    if (search.has("targetType") && search.has("targetId")) {
      const referenceCount = await service.referenceCount(
        projectId,
        search.get("targetType") as "item" | "event",
        search.get("targetId")!,
      );
      return NextResponse.json({ referenceCount });
    }
    if (search.has("items") || search.has("events")) {
      const targets = await service.resolve(
        projectId,
        ids(search.get("items")),
        ids(search.get("events")),
      );
      return NextResponse.json({ targets });
    }
    const candidates = await service.candidates(
      projectId,
      search.get("q") ?? "",
    );
    return NextResponse.json({ candidates });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
