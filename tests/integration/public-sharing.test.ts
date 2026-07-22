import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey)
  throw new Error("Local Supabase environment is required.");

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const owner = createClient<Database>(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const other = createClient<Database>(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient<Database>(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = `Public-${crypto.randomUUID()}`;
let ownerId = "";
let otherId = "";

async function createFixture() {
  const created = await owner.rpc("create_project_with_settings", {
    p_name: "公開文学史",
    p_description: "共有用タイムライン",
    p_template: "literature",
    p_default_uncertainty_years: 5,
    p_initial_start_year: 1800,
    p_initial_end_year: 2026,
    p_initial_zoom_preset: "fit-range",
    p_timeline_density: "comfortable",
    p_minimum_time_unit: "day",
  });
  if (created.error) throw created.error;
  const projectId = created.data;
  const type = await owner
    .from("timeline_item_types")
    .select("id")
    .eq("project_id", projectId)
    .limit(1)
    .single();
  if (type.error) throw type.error;
  const item = await owner
    .from("timeline_items")
    .insert({
      project_id: projectId,
      type_id: type.data.id,
      title: "公開人物",
      temporal_type: "range",
      manual_order: 0,
      start_year: 1900,
      end_date_status: "specified",
      end_year: 1950,
    })
    .select("id")
    .single();
  if (item.error) throw item.error;
  const event = await owner.from("timeline_events").insert({
    project_id: projectId,
    timeline_item_id: item.data.id,
    title: "公開イベント",
    event_year: 1920,
  });
  if (event.error) throw event.error;
  return { projectId, itemId: item.data.id };
}

describe("public project sharing RLS", () => {
  beforeAll(async () => {
    const ownerResult = await admin.auth.admin.createUser({
      email: `public-owner-${crypto.randomUUID()}@example.com`,
      password,
      email_confirm: true,
    });
    const otherResult = await admin.auth.admin.createUser({
      email: `public-other-${crypto.randomUUID()}@example.com`,
      password,
      email_confirm: true,
    });
    if (ownerResult.error) throw ownerResult.error;
    if (otherResult.error) throw otherResult.error;
    ownerId = ownerResult.data.user.id;
    otherId = otherResult.data.user.id;
    const [ownerSession, otherSession] = await Promise.all([
      owner.auth.signInWithPassword({
        email: ownerResult.data.user.email!,
        password,
      }),
      other.auth.signInWithPassword({
        email: otherResult.data.user.email!,
        password,
      }),
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

  it("publishes all read layers while keeping writes owner-only", async () => {
    const { projectId, itemId } = await createFixture();
    const published = await owner.rpc("publish_project", {
      p_project_id: projectId,
    });
    expect(published.error).toBeNull();
    expect(published.data).toMatch(/^[0-9a-f]{32}$/);

    const [project, settings, types, items, events] = await Promise.all([
      anonymous.from("projects").select("id").eq("id", projectId),
      anonymous
        .from("project_settings")
        .select("project_id")
        .eq("project_id", projectId),
      anonymous
        .from("timeline_item_types")
        .select("id")
        .eq("project_id", projectId),
      anonymous.from("timeline_items").select("id").eq("project_id", projectId),
      anonymous
        .from("timeline_events")
        .select("id")
        .eq("project_id", projectId),
    ]);
    for (const result of [project, settings, types, items, events]) {
      expect(result.error).toBeNull();
      expect(result.data?.length).toBeGreaterThan(0);
    }

    const otherWrite = await other
      .from("timeline_items")
      .update({ title: "改ざん" })
      .eq("id", itemId)
      .select("id");
    expect(otherWrite.error).toBeNull();
    expect(otherWrite.data).toEqual([]);
    const anonymousWrite = await anonymous
      .from("projects")
      .update({ name: "改ざん" })
      .eq("id", projectId);
    expect(anonymousWrite.error).not.toBeNull();
  });

  it("invalidates access immediately and rotates only when requested", async () => {
    const { projectId } = await createFixture();
    const firstPublish = await owner.rpc("publish_project", {
      p_project_id: projectId,
    });
    if (firstPublish.error) throw firstPublish.error;
    const firstId = firstPublish.data;

    const unpublished = await owner.rpc("unpublish_project", {
      p_project_id: projectId,
    });
    expect(unpublished.error).toBeNull();
    const hidden = await anonymous
      .from("projects")
      .select("id")
      .eq("public_id", firstId);
    expect(hidden.data).toEqual([]);

    const republished = await owner.rpc("publish_project", {
      p_project_id: projectId,
    });
    expect(republished.data).toBe(firstId);

    const regenerated = await owner.rpc("regenerate_project_public_id", {
      p_project_id: projectId,
    });
    expect(regenerated.error).toBeNull();
    expect(regenerated.data).not.toBe(firstId);
    const oldUrl = await anonymous
      .from("projects")
      .select("id")
      .eq("public_id", firstId);
    const newUrl = await anonymous
      .from("projects")
      .select("id")
      .eq("public_id", regenerated.data!);
    expect(oldUrl.data).toEqual([]);
    expect(newUrl.data).toEqual([{ id: projectId }]);
  });
});
