import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

const ownerEmail = `project-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `project-other-${crypto.randomUUID()}@example.com`;
const password = `Project-${crypto.randomUUID()}`;
let ownerId = "";
let otherUserId = "";

async function createOwnedProject(name = "文学史") {
  const { data, error } = await owner.rpc("create_project_with_settings", {
    p_name: name,
    p_description: "日本文学の流れ",
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

describe("project ownership RLS", () => {
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
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherUserId),
    ]);
  });

  it("lets the owner create, read, and update a private project", async () => {
    const projectId = await createOwnedProject();

    const { data: created, error: readError } = await owner
      .from("projects")
      .select("name, visibility")
      .eq("id", projectId)
      .single();
    expect(readError).toBeNull();
    expect(created).toEqual({ name: "文学史", visibility: "private" });

    const { data: updated, error: updateError } = await owner
      .from("projects")
      .update({ name: "近代文学史" })
      .eq("id", projectId)
      .select("name")
      .single();
    expect(updateError).toBeNull();
    expect(updated?.name).toBe("近代文学史");
  });

  it("hides private projects and settings from another user and anonymous clients", async () => {
    const projectId = await createOwnedProject("非公開史料");

    const [otherProjects, otherSettings, anonymousProjects] = await Promise.all(
      [
        otherUser.from("projects").select("id").eq("id", projectId),
        otherUser
          .from("project_settings")
          .select("project_id")
          .eq("project_id", projectId),
        anonymous.from("projects").select("id").eq("id", projectId),
      ],
    );

    expect(otherProjects.error).toBeNull();
    expect(otherProjects.data).toEqual([]);
    expect(otherSettings.error).toBeNull();
    expect(otherSettings.data).toEqual([]);
    expect(anonymousProjects.error).not.toBeNull();
  });

  it("rejects another user writing a project for the owner", async () => {
    const { error } = await otherUser.from("projects").insert({
      owner_id: ownerId,
      name: "不正なプロジェクト",
    });

    expect(error).not.toBeNull();
  });

  it("requires a non-empty name at the database boundary", async () => {
    const { error } = await owner.from("projects").insert({
      owner_id: ownerId,
      name: "   ",
    });

    expect(error).not.toBeNull();
  });

  it("cascades project settings when the owner permanently deletes a project", async () => {
    const projectId = await createOwnedProject("削除対象");

    const { error } = await owner.from("projects").delete().eq("id", projectId);
    expect(error).toBeNull();

    const { data: settings, error: settingsError } = await admin
      .from("project_settings")
      .select("project_id")
      .eq("project_id", projectId);
    expect(settingsError).toBeNull();
    expect(settings).toEqual([]);
  });
});
