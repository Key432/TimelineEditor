import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key || !serviceKey)
  throw new Error("Local Supabase environment is required.");
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
const owner = createClient(url, key, { auth: { persistSession: false } });
const other = createClient(url, key, { auth: { persistSession: false } });
const anonymous = createClient(url, key, { auth: { persistSession: false } });
const password = `Classification-${crypto.randomUUID()}`;
let ownerId = "";
let otherId = "";

async function project(name: string) {
  const { data, error } = await owner.rpc("create_project_with_settings", {
    p_name: name,
    p_description: null,
    p_template: "general",
    p_default_uncertainty_years: 5,
    p_initial_start_year: 1800,
    p_initial_end_year: 2026,
    p_initial_zoom_preset: "fit-range",
    p_timeline_density: "comfortable",
    p_minimum_time_unit: "day",
  });
  if (error) throw error;
  return data as string;
}

describe("Phase L9 classification RLS and integrity", () => {
  beforeAll(async () => {
    const ownerEmail = `classification-owner-${crypto.randomUUID()}@example.com`;
    const otherEmail = `classification-other-${crypto.randomUUID()}@example.com`;
    const [a, b] = await Promise.all([
      admin.auth.admin.createUser({
        email: ownerEmail,
        password,
        email_confirm: true,
      }),
      admin.auth.admin.createUser({
        email: otherEmail,
        password,
        email_confirm: true,
      }),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    ownerId = a.data.user.id;
    otherId = b.data.user.id;
    const [x, y] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password }),
      other.auth.signInWithPassword({ email: otherEmail, password }),
    ]);
    if (x.error) throw x.error;
    if (y.error) throw y.error;
    await Promise.all([
      waitUntilAccessTokenIsCurrent(x.data.session!.access_token),
      waitUntilAccessTokenIsCurrent(y.data.session!.access_token),
    ]);
  });
  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherId),
    ]);
  });

  it("stores shared tags, event marker styling, and sparse typed values", async () => {
    const projectId = await project("分類");
    const { data: itemType } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    const { data: item, error: itemError } = await owner
      .from("timeline_items")
      .insert({
        project_id: projectId,
        type_id: itemType!.id,
        title: "人物",
        temporal_type: "range",
        manual_order: 0,
        start_year: 1900,
        end_date_status: "specified",
        end_year: 1950,
      })
      .select("id")
      .single();
    if (itemError) throw itemError;
    const { data: markerType, error: markerError } = await owner
      .from("event_types")
      .insert({
        project_id: projectId,
        name: "出版",
        color: "#123456",
        marker_shape: "diamond",
      })
      .select("id, color, marker_shape")
      .single();
    if (markerError) throw markerError;
    const { data: event, error: eventError } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: item.id,
        event_type_id: markerType.id,
        title: "刊行",
        event_year: 1910,
      })
      .select("id, event_type_id")
      .single();
    if (eventError) throw eventError;
    const { data: tag } = await owner
      .from("tags")
      .insert({ project_id: projectId, name: "文学", color: "#FDE68A" })
      .select("id")
      .single();
    expect(
      (
        await owner.from("timeline_item_tags").insert({
          project_id: projectId,
          timeline_item_id: item.id,
          tag_id: tag!.id,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner.from("timeline_event_tags").insert({
          project_id: projectId,
          timeline_event_id: event.id,
          tag_id: tag!.id,
        })
      ).error,
    ).toBeNull();
    const { data: field } = await owner
      .from("custom_field_definitions")
      .insert({
        project_id: projectId,
        entity_type: "timeline_event",
        name: "部数",
        field_type: "number",
        is_required: false,
      })
      .select("id")
      .single();
    expect(
      (
        await owner.from("custom_field_values").insert({
          project_id: projectId,
          field_id: field!.id,
          entity_type: "timeline_event",
          entity_id: event.id,
          number_value: 1000,
        })
      ).error,
    ).toBeNull();
    const empty = await owner.from("custom_field_values").insert({
      project_id: projectId,
      field_id: field!.id,
      entity_type: "timeline_event",
      entity_id: crypto.randomUUID(),
    });
    expect(empty.error).not.toBeNull();
    expect(
      (
        await owner.from("custom_field_definitions").insert({
          project_id: projectId,
          entity_type: "timeline_event",
          scope: "type",
          target_type_id: markerType.id,
          name: "種別専用",
          field_type: "text",
          is_required: false,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner
          .from("event_types")
          .delete()
          .eq("project_id", projectId)
          .eq("id", markerType.id)
      ).error?.code,
    ).toBe("23503");
    expect(markerType).toMatchObject({
      color: "#123456",
      marker_shape: "diamond",
    });
  });

  it("prevents cross-project relations and unauthorized writes while allowing public reads", async () => {
    const first = await project("第一");
    const second = await project("第二");
    const { data: tag } = await owner
      .from("tags")
      .insert({ project_id: first, name: "公開タグ" })
      .select("id")
      .single();
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", second)
      .limit(1)
      .single();
    const { data: item } = await owner
      .from("timeline_items")
      .insert({
        project_id: second,
        type_id: type!.id,
        title: "別項目",
        temporal_type: "point",
        manual_order: 0,
        start_year: 2000,
      })
      .select("id")
      .single();
    const cross = await owner.from("timeline_item_tags").insert({
      project_id: second,
      timeline_item_id: item!.id,
      tag_id: tag!.id,
    });
    expect(cross.error?.code).toBe("23503");
    expect(
      (await other.from("tags").insert({ project_id: first, name: "不正" }))
        .error,
    ).not.toBeNull();
    expect(
      (await anonymous.from("tags").select("id").eq("project_id", first)).data,
    ).toEqual([]);
    expect(
      (await owner.rpc("publish_project", { p_project_id: first })).error,
    ).toBeNull();
    expect(
      (await anonymous.from("tags").select("id").eq("project_id", first)).data,
    ).toEqual([{ id: tag!.id }]);
    const changed = await other
      .from("tags")
      .update({ name: "改ざん" })
      .eq("id", tag!.id)
      .select("id");
    expect(changed.data).toEqual([]);
  });

  it("merges duplicate tag relations without duplicating entity links", async () => {
    const projectId = await project("統合");
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    const { data: item } = await owner
      .from("timeline_items")
      .insert({
        project_id: projectId,
        type_id: type!.id,
        title: "対象",
        temporal_type: "point",
        manual_order: 0,
        start_year: 2000,
      })
      .select("id")
      .single();
    const { data: tags } = await owner
      .from("tags")
      .insert([
        { project_id: projectId, name: "元" },
        { project_id: projectId, name: "先" },
      ])
      .select("id, name");
    const source = tags!.find((tag) => tag.name === "元")!;
    const target = tags!.find((tag) => tag.name === "先")!;
    await owner.from("timeline_item_tags").insert([
      { project_id: projectId, timeline_item_id: item!.id, tag_id: source.id },
      { project_id: projectId, timeline_item_id: item!.id, tag_id: target.id },
    ]);
    expect(
      (
        await owner.rpc("merge_tags", {
          p_project_id: projectId,
          p_source_tag_id: source.id,
          p_target_tag_id: target.id,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner
          .from("timeline_item_tags")
          .select("tag_id")
          .eq("timeline_item_id", item!.id)
      ).data,
    ).toEqual([{ tag_id: target.id }]);
  });

  it("round-trips L9 IDs through the version 4 import mapping", async () => {
    const projectId = await project("L9 import");
    const typeId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    const eventTypeId = crypto.randomUUID();
    const fieldId = crypto.randomUUID();
    const payload = {
      schemaVersion: 4,
      appVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      project: {
        id: crypto.randomUUID(),
        name: "source",
        description: null,
        visibility: "private",
        publicId: null,
        publishedAt: null,
      },
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1800,
        initialEndYear: 2026,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
      itemTypes: [
        {
          id: typeId,
          name: "Imported type",
          defaultColor: "#00B0B0",
          icon: null,
          sortOrder: 0,
          isVisible: true,
        },
      ],
      tags: [
        {
          id: tagId,
          name: "Imported tag",
          color: "#FDE68A",
          description: null,
        },
      ],
      eventTypes: [
        {
          id: eventTypeId,
          name: "Imported event type",
          color: "#123456",
          markerShape: "diamond",
          description: null,
          sortOrder: 0,
        },
      ],
      customFields: [
        {
          id: fieldId,
          entityType: "timeline_event",
          scope: "project",
          targetTypeId: null,
          name: "Count",
          fieldType: "number",
          isRequired: true,
          options: [],
          description: null,
          sortOrder: 0,
        },
      ],
      timelineItems: [
        {
          id: itemId,
          typeId,
          title: "Imported item",
          aliases: [],
          tagIds: [tagId],
          customFields: [],
          description: null,
          sourceText: null,
          externalUrl: null,
          temporalType: "range",
          colorOverride: null,
          manualOrder: 0,
          isVisible: true,
          start: {
            era: "ce",
            precision: "year",
            year: 1900,
            month: null,
            day: null,
            originalText: null,
            calendar: "proleptic_gregorian",
          },
          isStartApproximate: false,
          startUncertaintyYears: null,
          endDateStatus: "specified",
          end: {
            era: "ce",
            precision: "year",
            year: 1950,
            month: null,
            day: null,
            originalText: null,
            calendar: "proleptic_gregorian",
          },
          isEndApproximate: false,
          endUncertaintyYears: null,
          lastConfirmed: null,
          point: null,
          isPointApproximate: false,
        },
      ],
      timelineEvents: [
        {
          id: eventId,
          timelineItemId: itemId,
          eventTypeId,
          title: "Imported event",
          aliases: [],
          tagIds: [tagId],
          customFields: [{ fieldId, value: 42 }],
          date: {
            era: "ce",
            precision: "year",
            year: 1910,
            month: null,
            day: null,
            originalText: null,
            calendar: "proleptic_gregorian",
          },
          isApproximate: false,
          description: null,
          sourceText: null,
          externalUrl: null,
        },
      ],
    };
    const imported = await owner.rpc("import_project_data", {
      p_target_project_id: projectId,
      p_mode: "append",
      p_payload: payload,
    });
    expect(imported.error).toBeNull();
    const { data: event } = await owner
      .from("timeline_events")
      .select("id, event_type_id")
      .eq("project_id", projectId)
      .eq("title", "Imported event")
      .single();
    const [
      { data: importedTag },
      { data: importedType },
      { data: value },
      { data: link },
    ] = await Promise.all([
      owner
        .from("tags")
        .select("id")
        .eq("project_id", projectId)
        .eq("name", "Imported tag")
        .single(),
      owner
        .from("event_types")
        .select("id, marker_shape, color")
        .eq("project_id", projectId)
        .eq("name", "Imported event type")
        .single(),
      owner
        .from("custom_field_values")
        .select("number_value")
        .eq("project_id", projectId)
        .eq("entity_id", event!.id)
        .single(),
      owner
        .from("timeline_event_tags")
        .select("tag_id")
        .eq("timeline_event_id", event!.id)
        .single(),
    ]);
    expect(event?.event_type_id).toBe(importedType?.id);
    expect(importedType).toMatchObject({
      marker_shape: "diamond",
      color: "#123456",
    });
    expect(value?.number_value).toBe(42);
    expect(link?.tag_id).toBe(importedTag?.id);
  });
});
