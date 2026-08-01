import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ProjectAnalysisService } from "@/lib/services/project-analysis-service";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey)
  throw new Error("Local Supabase environment is required.");

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const owner = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const other = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = `L13-${crypto.randomUUID()}`;
const ownerEmail = `l13-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `l13-other-${crypto.randomUUID()}@example.com`;
let ownerId = "";
let otherId = "";

async function createProject() {
  const result = await owner.rpc("create_project_with_settings", {
    p_name: "Phase L13 quality",
    p_description: null,
    p_template: "general",
    p_default_uncertainty_years: 5,
    p_initial_start_year: 1500,
    p_initial_end_year: 1700,
    p_initial_zoom_preset: "fit-range",
    p_timeline_density: "comfortable",
    p_minimum_time_unit: "day",
  });
  if (result.error) throw result.error;
  return result.data as string;
}

describe("Phase L13 analysis, merge, Undo and RLS", () => {
  beforeAll(async () => {
    const [createdOwner, createdOther] = await Promise.all([
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
    if (createdOwner.error) throw createdOwner.error;
    if (createdOther.error) throw createdOther.error;
    ownerId = createdOwner.data.user.id;
    otherId = createdOther.data.user.id;
    const [ownerSession, otherSession] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password }),
      other.auth.signInWithPassword({ email: otherEmail, password }),
    ]);
    if (ownerSession.error) throw ownerSession.error;
    if (otherSession.error) throw otherSession.error;
    await Promise.all([
      waitUntilAccessTokenIsCurrent(ownerSession.data.session!.access_token),
      waitUntilAccessTokenIsCurrent(otherSession.data.session!.access_token),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherId),
    ]);
  });

  it("analyzes only for the owner and merges references transactionally with Undo", async () => {
    const projectId = await createProject();
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    const { data: items, error: itemError } = await owner
      .from("timeline_items")
      .insert([
        {
          project_id: projectId,
          type_id: type!.id,
          title: "織田 信長",
          aliases: [],
          temporal_type: "range",
          manual_order: 0,
          start_year: 1534,
          end_date_status: "specified",
          end_year: 1582,
          description: "残す本文",
        },
        {
          project_id: projectId,
          type_id: type!.id,
          title: "織田信長",
          aliases: ["信長"],
          temporal_type: "range",
          manual_order: 1,
          start_year: 1534,
          end_date_status: "specified",
          end_year: 1582,
          description: "統合する本文",
        },
        {
          project_id: projectId,
          type_id: type!.id,
          title: "参照元",
          aliases: [],
          temporal_type: "point",
          manual_order: 2,
          start_year: 1580,
        },
      ])
      .select("id, title");
    if (itemError || !items) throw itemError ?? new Error("items required");
    const survivor = items.find((item) => item.title === "織田 信長")!;
    const merged = items.find((item) => item.title === "織田信長")!;
    const referrer = items.find((item) => item.title === "参照元")!;
    await owner
      .from("timeline_items")
      .update({ description: `[[item:${merged.id}|信長]]` })
      .eq("id", referrer.id);
    const { data: event } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: merged.id,
        title: "本能寺の変",
        event_year: 1582,
      })
      .select("id")
      .single();
    const { data: tag } = await owner
      .from("tags")
      .insert({ project_id: projectId, name: "戦国", color: "#00B0B0" })
      .select("id")
      .single();
    await owner.from("timeline_item_tags").insert({
      project_id: projectId,
      timeline_item_id: merged.id,
      tag_id: tag!.id,
    });
    const { data: source } = await owner
      .from("sources")
      .insert({ project_id: projectId, title: "信長公記" })
      .select("id")
      .single();
    await owner.from("source_citations").insert({
      project_id: projectId,
      source_id: source!.id,
      entity_type: "timeline_item",
      entity_id: merged.id,
    });
    const { data: referenceField, error: referenceFieldError } = await owner
      .from("custom_field_definitions")
      .insert({
        project_id: projectId,
        entity_type: "timeline_item",
        scope: "project",
        name: "関連人物",
        field_type: "entity_reference",
      })
      .select("id")
      .single();
    if (referenceFieldError) throw referenceFieldError;
    await owner.from("custom_field_values").insert({
      project_id: projectId,
      field_id: referenceField.id,
      entity_type: "timeline_item",
      entity_id: referrer.id,
      reference_entity_type: "timeline_item",
      reference_entity_id: merged.id,
    });
    await owner.from("entity_relationships").insert({
      project_id: projectId,
      source_type: "timeline_item",
      source_id: merged.id,
      target_type: "timeline_item",
      target_id: referrer.id,
      relation_type: "参照",
      direction: "directed",
      line_style: "double",
      source_marker: "arrow",
      target_marker: "arrow",
    });

    const ownerService = new ProjectAnalysisService(owner);
    const analysis = await ownerService.analyze(projectId);
    expect(
      analysis.duplicates.some(
        (entry) =>
          new Set([entry.left.id, entry.right.id]).size === 2 &&
          [entry.left.id, entry.right.id].includes(survivor.id) &&
          [entry.left.id, entry.right.id].includes(merged.id),
      ),
    ).toBe(true);
    await expect(
      new ProjectAnalysisService(other).analyze(projectId),
    ).rejects.toMatchObject({ status: 404 });

    const preview = await ownerService.merge(projectId, {
      entityType: "timeline_item",
      survivorId: survivor.id,
      mergedId: merged.id,
      preview: true,
    });
    expect(preview).toMatchObject({
      preview: true,
      transfers: {
        tags: 1,
        citations: 1,
        parentsOrEvents: 1,
        internalLinks: 1,
        relationships: 1,
      },
    });
    const result = await ownerService.merge(projectId, {
      entityType: "timeline_item",
      survivorId: survivor.id,
      mergedId: merged.id,
      preview: false,
    });
    if (!("operationId" in result)) throw new Error("operation required");

    expect(
      (
        await admin
          .from("timeline_items")
          .select("deleted_at")
          .eq("id", merged.id)
          .single()
      ).data?.deleted_at,
    ).not.toBeNull();
    expect(
      (
        await owner
          .from("timeline_event_item_links")
          .select("timeline_item_id")
          .eq("timeline_event_id", event!.id)
      ).data,
    ).toEqual([{ timeline_item_id: survivor.id }]);
    expect(
      (
        await owner
          .from("timeline_item_tags")
          .select("tag_id")
          .eq("timeline_item_id", survivor.id)
      ).data,
    ).toEqual([{ tag_id: tag!.id }]);
    expect(
      (
        await owner
          .from("source_citations")
          .select("entity_id")
          .eq("source_id", source!.id)
      ).data,
    ).toEqual([{ entity_id: survivor.id }]);
    expect(
      (
        await owner
          .from("timeline_items")
          .select("description")
          .eq("id", referrer.id)
          .single()
      ).data?.description,
    ).toContain(survivor.id);
    expect(
      (
        await owner
          .from("custom_field_values")
          .select("reference_entity_id")
          .eq("field_id", referenceField.id)
          .single()
      ).data?.reference_entity_id,
    ).toBe(survivor.id);
    expect(
      (
        await owner
          .from("entity_relationships")
          .select(
            "source_id, relation_type, direction, line_style, source_marker, target_marker",
          )
          .eq("project_id", projectId)
          .single()
      ).data,
    ).toMatchObject({
      source_id: survivor.id,
      relation_type: "参照",
      direction: "directed",
      line_style: "double",
      source_marker: "arrow",
      target_marker: "arrow",
    });

    await ownerService.undo(projectId, { operationId: result.operationId });
    expect(
      (
        await admin
          .from("timeline_items")
          .select("deleted_at")
          .eq("id", merged.id)
          .single()
      ).data?.deleted_at,
    ).toBeNull();
    expect(
      (
        await owner
          .from("timeline_event_item_links")
          .select("timeline_item_id")
          .eq("timeline_event_id", event!.id)
      ).data,
    ).toEqual([{ timeline_item_id: merged.id }]);
    expect(
      (
        await owner
          .from("timeline_item_tags")
          .select("tag_id")
          .eq("timeline_item_id", survivor.id)
      ).data,
    ).toEqual([]);
    expect(
      (
        await owner
          .from("source_citations")
          .select("entity_id")
          .eq("source_id", source!.id)
      ).data,
    ).toEqual([{ entity_id: merged.id }]);
    expect(
      (
        await owner
          .from("timeline_items")
          .select("description")
          .eq("id", referrer.id)
          .single()
      ).data?.description,
    ).toContain(merged.id);
    expect(
      (
        await owner
          .from("custom_field_values")
          .select("reference_entity_id")
          .eq("field_id", referenceField.id)
          .single()
      ).data?.reference_entity_id,
    ).toBe(merged.id);
    expect(
      (
        await owner
          .from("entity_relationships")
          .select(
            "source_id, relation_type, direction, line_style, source_marker, target_marker",
          )
          .eq("project_id", projectId)
          .single()
      ).data,
    ).toMatchObject({
      source_id: merged.id,
      relation_type: "参照",
      direction: "directed",
      line_style: "double",
      source_marker: "arrow",
      target_marker: "arrow",
    });
  });
});
