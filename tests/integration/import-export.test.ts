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
const password = `Import-${crypto.randomUUID()}`;
let ownerId = "";
let otherId = "";
let targetId = "";

const sourceTypeId = "11111111-1111-4111-8111-111111111111";
const sourceItemId = "22222222-2222-4222-8222-222222222222";

function payload(name = "取り込み元") {
  return {
    schemaVersion: 1,
    appVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    project: {
      id: targetId,
      name,
      description: "バックアップ",
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
        id: sourceTypeId,
        name: "人物",
        defaultColor: "#2878B5",
        icon: "user-round",
        sortOrder: 0,
        isVisible: true,
      },
    ],
    timelineItems: [
      {
        id: sourceItemId,
        typeId: sourceTypeId,
        title: "取り込み項目",
        description: null,
        sourceText: null,
        externalUrl: null,
        temporalType: "range",
        colorOverride: null,
        manualOrder: 0,
        isVisible: true,
        start: { year: 1900, month: null, day: null },
        isStartApproximate: false,
        startUncertaintyYears: null,
        endDateStatus: "specified",
        end: { year: 1950, month: null, day: null },
        isEndApproximate: false,
        endUncertaintyYears: null,
        lastConfirmed: null,
        point: null,
        isPointApproximate: false,
      },
    ],
    timelineEvents: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        timelineItemId: sourceItemId,
        title: "取り込みイベント",
        date: { year: 1920, month: null, day: null },
        isApproximate: false,
        description: null,
        sourceText: null,
        externalUrl: null,
      },
    ],
  };
}

async function createProject() {
  const { data, error } = await owner.rpc("create_project_with_settings", {
    p_name: "取り込み先",
    p_description: null,
    p_template: "empty",
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

describe("transactional project import", () => {
  beforeAll(async () => {
    const ownerUser = await admin.auth.admin.createUser({
      email: `import-owner-${crypto.randomUUID()}@example.com`,
      password,
      email_confirm: true,
    });
    const otherUser = await admin.auth.admin.createUser({
      email: `import-other-${crypto.randomUUID()}@example.com`,
      password,
      email_confirm: true,
    });
    if (ownerUser.error) throw ownerUser.error;
    if (otherUser.error) throw otherUser.error;
    ownerId = ownerUser.data.user.id;
    otherId = otherUser.data.user.id;
    const ownerSession = await owner.auth.signInWithPassword({
      email: ownerUser.data.user.email!,
      password,
    });
    const otherSession = await other.auth.signInWithPassword({
      email: otherUser.data.user.email!,
      password,
    });
    if (ownerSession.error) throw ownerSession.error;
    if (otherSession.error) throw otherSession.error;
    await Promise.all([
      waitUntilAccessTokenIsCurrent(ownerSession.data.session!.access_token),
      waitUntilAccessTokenIsCurrent(otherSession.data.session!.access_token),
    ]);
    targetId = await createProject();
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherId),
    ]);
  });

  it("duplicates a complete JSON graph with new IDs", async () => {
    const { data: duplicateId, error } = await owner.rpc(
      "import_project_data",
      {
        p_target_project_id: targetId,
        p_mode: "duplicate",
        p_payload: payload(),
      },
    );
    expect(error).toBeNull();
    expect(duplicateId).not.toBe(targetId);
    const [projects, types, items, events] = await Promise.all([
      owner
        .from("projects")
        .select("name, visibility")
        .eq("id", duplicateId!)
        .single(),
      owner
        .from("timeline_item_types")
        .select("id")
        .eq("project_id", duplicateId!),
      owner.from("timeline_items").select("id").eq("project_id", duplicateId!),
      owner.from("timeline_events").select("id").eq("project_id", duplicateId!),
    ]);
    expect(projects.data).toEqual({
      name: "取り込み元 (コピー)",
      visibility: "private",
    });
    expect([
      types.data?.length,
      items.data?.length,
      events.data?.length,
    ]).toEqual([1, 1, 1]);
  });

  it("creates a new private project without a target project ID", async () => {
    const result = await owner.rpc("import_project_data", {
      p_target_project_id: null,
      p_mode: "create",
      p_payload: payload("新規取り込み"),
    });
    expect(result.error).toBeNull();
    const project = await owner
      .from("projects")
      .select("name, visibility")
      .eq("id", result.data!)
      .single();
    expect(project.data).toEqual({
      name: "新規取り込み",
      visibility: "private",
    });
  });

  it("overwrites atomically and rolls back an invalid append", async () => {
    const overwrite = await owner.rpc("import_project_data", {
      p_target_project_id: targetId,
      p_mode: "overwrite",
      p_payload: payload("上書き後"),
    });
    expect(overwrite.error).toBeNull();
    const broken = payload();
    broken.timelineEvents[0]!.timelineItemId =
      "44444444-4444-4444-8444-444444444444";
    const append = await owner.rpc("import_project_data", {
      p_target_project_id: targetId,
      p_mode: "append",
      p_payload: broken,
    });
    expect(append.error).not.toBeNull();
    const [project, items, events] = await Promise.all([
      owner.from("projects").select("name").eq("id", targetId).single(),
      owner.from("timeline_items").select("id").eq("project_id", targetId),
      owner.from("timeline_events").select("id").eq("project_id", targetId),
    ]);
    expect(project.data?.name).toBe("上書き後");
    expect(items.data).toHaveLength(1);
    expect(events.data).toHaveLength(1);
  });

  it("rejects another user and anonymous callers", async () => {
    const [otherResult, anonymousResult] = await Promise.all([
      other.rpc("import_project_data", {
        p_target_project_id: targetId,
        p_mode: "overwrite",
        p_payload: payload(),
      }),
      anonymous.rpc("import_project_data", {
        p_target_project_id: targetId,
        p_mode: "overwrite",
        p_payload: payload(),
      }),
    ]);
    expect(otherResult.error).not.toBeNull();
    expect(anonymousResult.error).not.toBeNull();
  });

  it("updates an ID-matched item when importing only timeline-items.csv", async () => {
    const current = await owner
      .from("timeline_items")
      .select("id, type_id")
      .eq("project_id", targetId)
      .single();
    if (current.error) throw current.error;
    const partial = payload();
    partial.timelineItems[0]!.id = current.data.id;
    partial.timelineItems[0]!.typeId = current.data.type_id;
    partial.timelineItems[0]!.title = "CSV更新後";
    const result = await owner.rpc("import_project_data", {
      p_target_project_id: targetId,
      p_mode: "append",
      p_payload: {
        ...partial,
        itemTypes: [],
        timelineEvents: [],
        importSections: ["timelineItems"],
      },
    });
    expect(result.error).toBeNull();
    const items = await owner
      .from("timeline_items")
      .select("title")
      .eq("project_id", targetId);
    expect(items.data).toEqual([{ title: "CSV更新後" }]);
  });

  it("imports an auto-created item type and its timeline item atomically", async () => {
    const newTypeId = crypto.randomUUID();
    const newItemId = crypto.randomUUID();
    const partial = payload();
    partial.itemTypes = [
      {
        id: newTypeId,
        name: "CSV自動作成種別",
        defaultColor: "#00B0B0",
        icon: "circle-dot",
        sortOrder: 1,
        isVisible: true,
      },
    ];
    partial.timelineItems[0] = {
      ...partial.timelineItems[0]!,
      id: newItemId,
      typeId: newTypeId,
      title: "自動作成種別の項目",
    };
    const result = await owner.rpc("import_project_data", {
      p_target_project_id: targetId,
      p_mode: "append",
      p_payload: {
        ...partial,
        timelineEvents: [],
        importSections: ["itemTypes", "timelineItems"],
      },
    });
    expect(result.error).toBeNull();
    const createdType = await owner
      .from("timeline_item_types")
      .select("id, default_color, sort_order")
      .eq("project_id", targetId)
      .eq("name", "CSV自動作成種別")
      .single();
    expect(createdType.data).toMatchObject({
      default_color: "#00B0B0",
      sort_order: 1,
    });
    const createdItem = await owner
      .from("timeline_items")
      .select("type_id")
      .eq("project_id", targetId)
      .eq("title", "自動作成種別の項目")
      .single();
    expect(createdItem.data?.type_id).toBe(createdType.data?.id);
  });
});
