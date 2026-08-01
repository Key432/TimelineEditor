import { NextResponse } from "next/server";

import { tablePreferenceSchema } from "@/features/table-view/validation";
import { apiErrorResponse } from "@/lib/api-response";
import { ProjectService } from "@/lib/services/project-service";
import { ServiceError } from "@/lib/services/errors";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

function mapPreference(row: {
  id: string;
  entity_type: "timeline_item" | "timeline_event";
  visible_columns: unknown;
  column_order: unknown;
  column_widths: unknown;
  wrapped_columns: unknown;
  frozen_column_count: number;
  updated_at: string;
}) {
  return {
    id: row.id,
    entityType: row.entity_type,
    visibleColumns: Array.isArray(row.visible_columns)
      ? row.visible_columns
      : [],
    columnOrder: Array.isArray(row.column_order) ? row.column_order : [],
    columnWidths:
      row.column_widths && typeof row.column_widths === "object"
        ? row.column_widths
        : {},
    wrappedColumns: Array.isArray(row.wrapped_columns)
      ? row.wrapped_columns
      : [],
    frozenColumnCount: row.frozen_column_count,
    updatedAt: row.updated_at,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const client = await createClient();
    await new ProjectService(client).get(projectId);
    const { data, error } = await client
      .from("table_view_preferences")
      .select("*")
      .eq("project_id", projectId);
    if (error) throw error;
    return NextResponse.json({ preferences: data.map(mapPreference) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const input = tablePreferenceSchema.safeParse(await request.json());
    if (!input.success)
      throw new ServiceError(
        "テーブル設定を確認してください。",
        400,
        "VALIDATION_ERROR",
        input.error.flatten(),
      );
    const client = await createClient();
    await new ProjectService(client).get(projectId);
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      throw new ServiceError("ログインが必要です。", 401, "UNAUTHENTICATED");
    const { data, error } = await client
      .from("table_view_preferences")
      .upsert(
        {
          project_id: projectId,
          owner_id: auth.user.id,
          entity_type: input.data.entityType,
          visible_columns: input.data.visibleColumns,
          column_order: input.data.columnOrder,
          column_widths: input.data.columnWidths,
          wrapped_columns: input.data.wrappedColumns,
          frozen_column_count: input.data.frozenColumnCount,
        },
        { onConflict: "project_id,owner_id,entity_type" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ preference: mapPreference(data) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
