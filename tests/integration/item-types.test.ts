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

const ownerEmail = `item-type-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `item-type-other-${crypto.randomUUID()}@example.com`;
const password = `ItemType-${crypto.randomUUID()}`;
let ownerId = "";
let otherUserId = "";

async function createProject(template: string) {
  const { data, error } = await owner.rpc("create_project_with_settings", {
    p_name: `${template} project`,
    p_description: null,
    p_template: template,
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

describe("timeline item type management", () => {
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

  it.each([
    ["literature", 7, "文学運動"],
    ["art", 7, "芸術運動"],
    ["philosophy", 6, "思想潮流"],
    ["general", 10, "戦争"],
    ["empty", 0, null],
  ])(
    "seeds the %s template with its expected item types",
    async (template, expectedCount, expectedName) => {
      const projectId = await createProject(template);
      const { data, error } = await owner
        .from("timeline_item_types")
        .select("name, sort_order")
        .eq("project_id", projectId)
        .order("sort_order");

      expect(error).toBeNull();
      expect(data).toHaveLength(expectedCount);
      if (expectedName) {
        expect(data?.map((itemType) => itemType.name)).toContain(expectedName);
      }
      expect(data?.map((itemType) => itemType.sort_order)).toEqual(
        Array.from({ length: expectedCount }, (_, index) => index),
      );
    },
  );

  it("prevents duplicate normalized names and invalid colors", async () => {
    const projectId = await createProject("empty");
    const first = await owner.from("timeline_item_types").insert({
      project_id: projectId,
      name: "文学 運動",
      default_color: "#00B0B0",
      sort_order: 0,
    });
    expect(first.error).toBeNull();

    const duplicate = await owner.from("timeline_item_types").insert({
      project_id: projectId,
      name: "  文学   運動  ",
      default_color: "#FF3399",
      sort_order: 1,
    });
    expect(duplicate.error?.code).toBe("23505");

    const invalidColor = await owner.from("timeline_item_types").insert({
      project_id: projectId,
      name: "人物",
      default_color: "teal",
      sort_order: 1,
    });
    expect(invalidColor.error?.code).toBe("23514");
  });

  it("allows only the owner to read and write item types", async () => {
    const projectId = await createProject("literature");
    const [otherRead, anonymousRead, otherWrite] = await Promise.all([
      otherUser
        .from("timeline_item_types")
        .select("id")
        .eq("project_id", projectId),
      anonymous
        .from("timeline_item_types")
        .select("id")
        .eq("project_id", projectId),
      otherUser.from("timeline_item_types").insert({
        project_id: projectId,
        name: "不正な種別",
        default_color: "#00B0B0",
        sort_order: 20,
      }),
    ]);

    expect(otherRead.error).toBeNull();
    expect(otherRead.data).toEqual([]);
    expect(anonymousRead.error).toBeNull();
    expect(anonymousRead.data).toEqual([]);
    expect(otherWrite.error).not.toBeNull();
  });

  it("moves an item type and persists a contiguous order", async () => {
    const projectId = await createProject("philosophy");
    const { data: before, error: beforeError } = await owner
      .from("timeline_item_types")
      .select("id, name")
      .eq("project_id", projectId)
      .order("sort_order");
    if (beforeError) throw beforeError;
    const last = before?.at(-1);
    if (!last) throw new Error("Seeded item type is required.");

    const { error } = await owner.rpc("move_timeline_item_type", {
      p_project_id: projectId,
      p_type_id: last.id,
      p_new_position: 1,
    });
    expect(error).toBeNull();

    const { data: after, error: afterError } = await owner
      .from("timeline_item_types")
      .select("id, sort_order")
      .eq("project_id", projectId)
      .order("sort_order");
    expect(afterError).toBeNull();
    expect(after?.[1]?.id).toBe(last.id);
    expect(after?.map((itemType) => itemType.sort_order)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("deletes unused item types and cascades all types with the project", async () => {
    const projectId = await createProject("empty");
    const { data: created, error: createError } = await owner
      .from("timeline_item_types")
      .insert({
        project_id: projectId,
        name: "一時種別",
        default_color: "#00B0B0",
        sort_order: 0,
      })
      .select("id")
      .single();
    if (createError) throw createError;

    const { error: deleteTypeError } = await owner
      .from("timeline_item_types")
      .delete()
      .eq("id", created.id);
    expect(deleteTypeError).toBeNull();

    await owner.from("projects").delete().eq("id", projectId);
    const { data: remaining, error } = await admin
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId);
    expect(error).toBeNull();
    expect(remaining).toEqual([]);
  });
});
