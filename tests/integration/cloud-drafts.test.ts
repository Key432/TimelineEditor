import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Local Supabase environment is required.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const owner = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const otherUser = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ownerEmail = `draft-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `draft-other-${crypto.randomUUID()}@example.com`;
const password = `Draft-${crypto.randomUUID()}`;
let ownerId = "";
let otherUserId = "";

async function createProject(name: string) {
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

describe("cloud draft persistence and RLS", () => {
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
    otherUserId = otherResult.data.user.id;
    const [ownerSignIn, otherSignIn] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password }),
      otherUser.auth.signInWithPassword({ email: otherEmail, password }),
    ]);
    if (ownerSignIn.error) throw ownerSignIn.error;
    if (otherSignIn.error) throw otherSignIn.error;
    if (!ownerSignIn.data.session || !otherSignIn.data.session) {
      throw new Error("Authenticated sessions are required.");
    }
    await Promise.all([
      waitUntilAccessTokenIsCurrent(ownerSignIn.data.session.access_token),
      waitUntilAccessTokenIsCurrent(otherSignIn.data.session.access_token),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherUserId),
    ]);
  });

  it("stores one mutable row without changing the canonical entity", async () => {
    const projectId = await createProject("cloud draft overwrite");
    const scope = crypto.randomUUID();
    const first = await owner
      .from("cloud_drafts")
      .insert({
        project_id: projectId,
        entity_type: "timeline_item",
        draft_scope: scope,
        payload: { title: "first" },
        fingerprint: "first",
        writer_id: "device-a",
      })
      .select("id, owner_id, draft_version")
      .single();
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ owner_id: ownerId, draft_version: 1 });

    const updated = await owner
      .from("cloud_drafts")
      .update({
        payload: { title: "second" },
        fingerprint: "second",
        draft_version: 2,
      })
      .eq("id", first.data!.id)
      .eq("draft_version", 1)
      .select("payload, draft_version")
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual({
      payload: { title: "second" },
      draft_version: 2,
    });
    const duplicate = await owner.from("cloud_drafts").insert({
      project_id: projectId,
      entity_type: "timeline_item",
      draft_scope: scope,
      payload: { title: "duplicate" },
      fingerprint: "duplicate",
      writer_id: "device-b",
    });
    expect(duplicate.error?.code).toBe("23505");

    const canonical = await owner
      .from("timeline_items")
      .select("id")
      .eq("project_id", projectId);
    expect(canonical.data).toEqual([]);
  });

  it("allows only the project owner to read, write, or delete drafts", async () => {
    const projectId = await createProject("private cloud draft");
    const scope = crypto.randomUUID();
    const created = await owner
      .from("cloud_drafts")
      .insert({
        project_id: projectId,
        entity_type: "timeline_event",
        draft_scope: scope,
        payload: { title: "private" },
        fingerprint: "private",
        writer_id: "owner-device",
      })
      .select("id")
      .single();
    if (created.error) throw created.error;

    const [otherRead, anonymousRead, otherInsert, otherDelete] =
      await Promise.all([
        otherUser.from("cloud_drafts").select("id").eq("id", created.data.id),
        anonymous.from("cloud_drafts").select("id").eq("id", created.data.id),
        otherUser.from("cloud_drafts").insert({
          project_id: projectId,
          entity_type: "timeline_event",
          draft_scope: crypto.randomUUID(),
          payload: { title: "stolen" },
          fingerprint: "stolen",
          writer_id: "other-device",
        }),
        otherUser.from("cloud_drafts").delete().eq("id", created.data.id),
      ]);
    expect(otherRead.data).toEqual([]);
    expect(anonymousRead.error?.code).toBe("42501");
    expect(otherInsert.error?.code).toBe("42501");
    expect(otherDelete.error).toBeNull();

    const stillPresent = await owner
      .from("cloud_drafts")
      .select("id")
      .eq("id", created.data.id)
      .single();
    expect(stillPresent.error).toBeNull();
  });

  it("rejects oversized payloads and removes drafts older than 30 days", async () => {
    const projectId = await createProject("draft retention");
    const oversized = await owner.from("cloud_drafts").insert({
      project_id: projectId,
      entity_type: "timeline_item",
      draft_scope: crypto.randomUUID(),
      payload: { text: "x".repeat(1_100_000) },
      fingerprint: "oversized",
      writer_id: "owner-device",
    });
    expect(oversized.error?.code).toBe("23514");

    const stale = await owner
      .from("cloud_drafts")
      .insert({
        project_id: projectId,
        entity_type: "timeline_item",
        draft_scope: crypto.randomUUID(),
        payload: { title: "stale" },
        fingerprint: "stale",
        writer_id: "owner-device",
      })
      .select("id")
      .single();
    if (stale.error) throw stale.error;
    await admin
      .from("cloud_drafts")
      .update({ updated_at: "2026-01-01T00:00:00.000Z" })
      .eq("id", stale.data.id);
    const cleanup = await admin.rpc("run_cloud_draft_cleanup");
    expect(cleanup.error).toBeNull();
    const removed = await admin
      .from("cloud_drafts")
      .select("id")
      .eq("id", stale.data.id);
    expect(removed.data).toEqual([]);
  });
});
