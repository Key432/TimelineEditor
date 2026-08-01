import { NextResponse } from "next/server";

import { csvMappingProfileSchema } from "@/features/table-view/validation";
import { apiErrorResponse } from "@/lib/api-response";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

function map(row: {
  id: string;
  name: string;
  entity_type: "timeline_item" | "timeline_event";
  mapping: unknown;
  date_format: "separate" | "iso" | "japanese";
}) {
  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type,
    mapping:
      row.mapping &&
      typeof row.mapping === "object" &&
      !Array.isArray(row.mapping)
        ? row.mapping
        : {},
    dateFormat: row.date_format,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const client = await createClient();
    await new ProjectService(client).get(projectId);
    const { data, error } = await client
      .from("csv_mapping_profiles")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ profiles: data.map(map) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const parsed = csvMappingProfileSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ServiceError(
        "CSVマッピング設定を確認してください。",
        400,
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    const client = await createClient();
    await new ProjectService(client).get(projectId);
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      throw new ServiceError("ログインが必要です。", 401, "UNAUTHENTICATED");
    const values = {
      project_id: projectId,
      owner_id: auth.user.id,
      name: parsed.data.name,
      entity_type: parsed.data.entityType,
      mapping: parsed.data.mapping,
      date_format: parsed.data.dateFormat,
    };
    const query = parsed.data.id
      ? client
          .from("csv_mapping_profiles")
          .update(values)
          .eq("id", parsed.data.id)
          .eq("project_id", projectId)
      : client.from("csv_mapping_profiles").insert(values);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return NextResponse.json({ profile: map(data) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
