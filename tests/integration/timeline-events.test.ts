import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
const ownerEmail = `event-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `event-other-${crypto.randomUUID()}@example.com`;
const password = `Events-${crypto.randomUUID()}`;
let ownerId = "";
let otherId = "";

async function createProject() {
  const { data, error } = await owner.rpc("create_project_with_settings", {
    p_name: "event project",
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

describe("timeline event persistence and RLS", () => {
  beforeAll(async () => {
    const [ownerResult, otherResult] = await Promise.all([
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
    if (ownerResult.error) throw ownerResult.error;
    if (otherResult.error) throw otherResult.error;
    ownerId = ownerResult.data.user.id;
    otherId = otherResult.data.user.id;
    const [ownerSignIn, otherSignIn] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password }),
      other.auth.signInWithPassword({ email: otherEmail, password }),
    ]);
    if (
      ownerSignIn.error ||
      otherSignIn.error ||
      !ownerSignIn.data.session ||
      !otherSignIn.data.session
    )
      throw new Error("Sessions required.");
    await Promise.all([
      waitUntilAccessTokenIsCurrent(ownerSignIn.data.session.access_token),
      waitUntilAccessTokenIsCurrent(otherSignIn.data.session.access_token),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherId),
    ]);
  });

  it("allows owner CRUD, accepts outside-range dates, and cascades with the parent", async () => {
    const projectId = await createProject();
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    const { data: parent, error: parentError } = await owner
      .from("timeline_items")
      .insert({
        project_id: projectId,
        type_id: type!.id,
        title: "parent",
        temporal_type: "range",
        manual_order: 0,
        start_year: 1900,
        end_date_status: "specified",
        end_year: 1910,
      })
      .select("id")
      .single();
    if (parentError) throw parentError;
    const { data: created, error } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: parent.id,
        title: "posthumous",
        event_year: 1920,
      })
      .select("id, event_year")
      .single();
    expect(error).toBeNull();
    if (!created) throw new Error("Created event is required.");
    expect(created.event_year).toBe(1920);
    const updated = await owner
      .from("timeline_events")
      .update({ title: "updated" })
      .eq("id", created.id)
      .select("title")
      .single();
    expect(updated.data?.title).toBe("updated");
    await owner.from("timeline_items").delete().eq("id", parent.id);
    const { data: remaining } = await admin
      .from("timeline_events")
      .select("id")
      .eq("id", created.id);
    expect(remaining).toEqual([]);
  });

  it("rejects point parents, cross-project parents, and point conversion with children", async () => {
    const first = await createProject();
    const second = await createProject();
    const { data: firstType } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", first)
      .limit(1)
      .single();
    const { data: secondType } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", second)
      .limit(1)
      .single();
    const { data: parents, error } = await owner
      .from("timeline_items")
      .insert([
        {
          project_id: first,
          type_id: firstType!.id,
          title: "range",
          temporal_type: "range",
          manual_order: 0,
          start_year: 1900,
          end_date_status: "specified",
          end_year: 1910,
        },
        {
          project_id: first,
          type_id: firstType!.id,
          title: "point",
          temporal_type: "point",
          manual_order: 1,
          point_year: 1905,
        },
        {
          project_id: second,
          type_id: secondType!.id,
          title: "other",
          temporal_type: "range",
          manual_order: 0,
          start_year: 1900,
          end_date_status: "specified",
          end_year: 1910,
        },
      ])
      .select("id, title");
    if (error) throw error;
    const range = parents!.find((item) => item.title === "range")!;
    const point = parents!.find((item) => item.title === "point")!;
    const otherParent = parents!.find((item) => item.title === "other")!;
    expect(
      (
        await owner.from("timeline_events").insert({
          project_id: first,
          timeline_item_id: point.id,
          title: "invalid",
          event_year: 1905,
        })
      ).error?.code,
    ).toBe("23514");
    expect(
      (
        await owner.from("timeline_events").insert({
          project_id: first,
          timeline_item_id: otherParent.id,
          title: "cross",
          event_year: 1905,
        })
      ).error?.code,
    ).toBe("23503");
    await owner.from("timeline_events").insert({
      project_id: first,
      timeline_item_id: range.id,
      title: "child",
      event_year: 1905,
    });
    const conversion = await owner
      .from("timeline_items")
      .update({
        temporal_type: "point",
        point_year: 1905,
        start_year: null,
        end_date_status: null,
        end_year: null,
      })
      .eq("id", range.id);
    expect(conversion.error?.code).toBe("23514");
  });

  it("hides private events from other users and protects writes", async () => {
    const projectId = await createProject();
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    const { data: parent } = await owner
      .from("timeline_items")
      .insert({
        project_id: projectId,
        type_id: type!.id,
        title: "private parent",
        temporal_type: "range",
        manual_order: 0,
        start_year: 1900,
        end_date_status: "ongoing",
      })
      .select("id")
      .single();
    const { data: event } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: parent!.id,
        title: "private event",
        event_year: 1905,
      })
      .select("id")
      .single();
    expect(
      (await other.from("timeline_events").select("id").eq("id", event!.id))
        .data,
    ).toEqual([]);
    expect(
      (
        await other
          .from("timeline_events")
          .update({ title: "stolen" })
          .eq("id", event!.id)
          .select("id")
      ).data,
    ).toEqual([]);
    expect(
      (
        await other
          .from("timeline_events")
          .delete()
          .eq("id", event!.id)
          .select("id")
      ).data,
    ).toEqual([]);
  });

  it("validates prepared relationship endpoints and removes orphaned relations", async () => {
    const projectId = await createProject();
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    const { data: parent } = await owner
      .from("timeline_items")
      .insert({
        project_id: projectId,
        type_id: type!.id,
        title: "relationship parent",
        temporal_type: "range",
        manual_order: 0,
        start_year: 1900,
        end_date_status: "ongoing",
      })
      .select("id")
      .single();
    const { data: event } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: parent!.id,
        title: "relationship event",
        event_year: 1905,
      })
      .select("id")
      .single();
    const { data: relation, error } = await owner
      .from("entity_relationships")
      .insert({
        project_id: projectId,
        source_type: "timeline_item",
        source_id: parent!.id,
        target_type: "timeline_event",
        target_id: event!.id,
        relation_type: "influence",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(
      (
        await owner.from("entity_relationships").insert({
          project_id: projectId,
          source_type: "timeline_item",
          source_id: crypto.randomUUID(),
          target_type: "timeline_event",
          target_id: event!.id,
          relation_type: "reference",
        })
      ).error?.code,
    ).toBe("23503");
    expect(
      (
        await other
          .from("entity_relationships")
          .select("id")
          .eq("id", relation!.id)
      ).data,
    ).toEqual([]);
    await owner.from("timeline_events").delete().eq("id", event!.id);
    expect(
      (
        await admin
          .from("entity_relationships")
          .select("id")
          .eq("id", relation!.id)
      ).data,
    ).toEqual([]);
  });
});
