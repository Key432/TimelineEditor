import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ComparisonService } from "@/lib/services/comparison-service";
import type { Database } from "@/lib/supabase/database.types";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey)
  throw new Error("Local Supabase environment is required.");

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const owner = createClient<Database>(url, publishableKey, {
  auth: { persistSession: false },
});
const other = createClient<Database>(url, publishableKey, {
  auth: { persistSession: false },
});
const anonymous = createClient<Database>(url, publishableKey, {
  auth: { persistSession: false },
});
const password = `Compare-${crypto.randomUUID()}`;
const ownerEmail = `compare-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `compare-other-${crypto.randomUUID()}@example.com`;
let ownerId = "";
let otherId = "";
let ownerProjectId = "";
let publicProjectId = "";
let privateProjectId = "";

async function createProject(client: typeof owner, name: string) {
  const { data, error } = await client.rpc("create_project_with_settings", {
    p_name: name,
    p_description: null,
    p_template: "general",
    p_default_uncertainty_years: 5,
    p_initial_start_year: 1700,
    p_initial_end_year: 2000,
    p_initial_zoom_preset: "fit-range",
    p_timeline_density: "comfortable",
    p_minimum_time_unit: "day",
  });
  if (error) throw error;
  return data as string;
}

describe("Phase L18 comparison project access", () => {
  beforeAll(async () => {
    const [ownerUser, otherUser] = await Promise.all([
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
    if (ownerUser.error) throw ownerUser.error;
    if (otherUser.error) throw otherUser.error;
    ownerId = ownerUser.data.user.id;
    otherId = otherUser.data.user.id;
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
    ownerProjectId = await createProject(owner, "所有プロジェクト");
    publicProjectId = await createProject(other, "公開比較先");
    privateProjectId = await createProject(other, "非公開比較先");
    const { error } = await other.rpc("publish_project", {
      p_project_id: publicProjectId,
    });
    if (error) throw error;
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherId),
    ]);
  });

  it("lists owned and public projects but never another user's private project", async () => {
    const projects = await new ComparisonService(owner).listProjects();
    expect(projects.map((project) => project.id)).toEqual(
      expect.arrayContaining([ownerProjectId, publicProjectId]),
    );
    expect(projects.map((project) => project.id)).not.toContain(
      privateProjectId,
    );
  });

  it("loads a public comparison timeline and rejects inaccessible or anonymous access", async () => {
    await expect(
      new ComparisonService(owner).loadProject(publicProjectId),
    ).resolves.toMatchObject({
      project: { id: publicProjectId },
      access: "public",
    });
    await expect(
      new ComparisonService(owner).loadProject(privateProjectId),
    ).rejects.toBeTruthy();
    await expect(
      new ComparisonService(anonymous).listProjects(),
    ).rejects.toMatchObject({
      status: 401,
    });
  });
});
