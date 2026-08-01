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
const anonymous = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = `L11-${crypto.randomUUID()}`;
const ownerEmail = `l11-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `l11-other-${crypto.randomUUID()}@example.com`;
let ownerId = "";
let otherId = "";

async function createProject() {
  const result = await owner.rpc("create_project_with_settings", {
    p_name: "Phase L11 RLS",
    p_description: null,
    p_template: "general",
    p_default_uncertainty_years: 5,
    p_initial_start_year: 1800,
    p_initial_end_year: 2026,
    p_initial_zoom_preset: "fit-range",
    p_timeline_density: "comfortable",
    p_minimum_time_unit: "day",
  });
  if (result.error) throw result.error;
  return result.data as string;
}

describe("Phase L11 preference and operation RLS", () => {
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

  it("allows only the owner to persist table and CSV settings", async () => {
    const projectId = await createProject();
    const preference = await owner
      .from("table_view_preferences")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        entity_type: "timeline_item",
        visible_columns: ["title", "start"],
        wrapped_columns: ["title"],
        column_widths: { title: 320 },
        frozen_column_count: 2,
      })
      .select("id")
      .single();
    expect(preference.error).toBeNull();

    const profile = await owner.from("csv_mapping_profiles").insert({
      project_id: projectId,
      owner_id: ownerId,
      name: "標準",
      entity_type: "timeline_item",
      mapping: { title: "Name", type: "=人物" },
      date_format: "separate",
    });
    expect(profile.error).toBeNull();

    const [otherRead, anonymousRead, otherInsert] = await Promise.all([
      other
        .from("table_view_preferences")
        .select("id")
        .eq("project_id", projectId),
      anonymous
        .from("csv_mapping_profiles")
        .select("id")
        .eq("project_id", projectId),
      other.from("table_view_preferences").insert({
        project_id: projectId,
        owner_id: otherId,
        entity_type: "timeline_event",
      }),
    ]);
    expect(otherRead.data).toEqual([]);
    expect(anonymousRead.error?.code).toBe("42501");
    expect(otherInsert.error?.code).toBe("42501");
  });

  it("stores one compressed inverse patch per bulk operation", async () => {
    const projectId = await createProject();
    const inserted = await owner
      .from("bulk_edit_operations")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        entity_type: "timeline_item",
        label: "2件の表示状態変更",
        affected_count: 2,
        inverse_patch: [
          { entityId: crypto.randomUUID(), patch: { isVisible: true } },
          { entityId: crypto.randomUUID(), patch: { isVisible: false } },
        ],
      })
      .select("id, affected_count")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.affected_count).toBe(2);
    const hidden = await other
      .from("bulk_edit_operations")
      .select("id")
      .eq("id", inserted.data!.id);
    expect(hidden.data).toEqual([]);
  });
});
