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

const ownerEmail = `history-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `history-other-${crypto.randomUUID()}@example.com`;
const password = `History-${crypto.randomUUID()}`;
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
  return data;
}

async function createItem(projectId: string, title: string) {
  const type = await owner
    .from("timeline_item_types")
    .select("id")
    .eq("project_id", projectId)
    .order("sort_order")
    .limit(1)
    .single();
  if (type.error) throw type.error;
  const item = await owner
    .from("timeline_items")
    .insert({
      project_id: projectId,
      type_id: type.data.id,
      title,
      description: "初期本文",
      temporal_type: "range",
      manual_order: 0,
      start_year: 1900,
      end_date_status: "specified",
      end_year: 1950,
    })
    .select("id")
    .single();
  if (item.error) throw item.error;
  return item.data.id;
}

describe("Phase L4 history, trash, and RLS", () => {
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
    await Promise.all([
      waitUntilAccessTokenIsCurrent(ownerSignIn.data.session!.access_token),
      waitUntilAccessTokenIsCurrent(otherSignIn.data.session!.access_token),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherUserId),
    ]);
  });

  it("stores only changed fields per save and restores an exact retained version", async () => {
    const projectId = await createProject("history restore");
    const itemId = await createItem(projectId, "初期タイトル");

    const firstSave = await owner
      .from("timeline_items")
      .update({ title: "第1版", description: "第1版の本文" })
      .eq("id", itemId);
    expect(firstSave.error).toBeNull();
    const secondSave = await owner
      .from("timeline_items")
      .update({ title: "第2版", description: "第2版の本文" })
      .eq("id", itemId);
    expect(secondSave.error).toBeNull();

    const history = await owner
      .from("entity_history")
      .select("id, revision, changes, operation")
      .eq("entity_id", itemId)
      .order("revision");
    expect(history.error).toBeNull();
    expect(history.data).toHaveLength(2);
    expect(history.data?.[0]?.changes).toEqual({
      description: { before: "初期本文", after: "第1版の本文" },
      title: { before: "初期タイトル", after: "第1版" },
    });

    const restore = await owner.rpc("restore_entity_history", {
      p_project_id: projectId,
      p_history_id: history.data![0]!.id,
    });
    expect(restore.error).toBeNull();
    expect(restore.data).toBe(true);
    const restored = await owner
      .from("timeline_items")
      .select("title, description")
      .eq("id", itemId)
      .single();
    expect(restored.data).toEqual({
      title: "第1版",
      description: "第1版の本文",
    });
    const restoreHistory = await owner
      .from("entity_history")
      .select("operation")
      .eq("entity_id", itemId)
      .order("revision", { ascending: false })
      .limit(1)
      .single();
    expect(restoreHistory.data?.operation).toBe("restore");
  });

  it("creates manual checkpoints and keeps only the newest 20 generations", async () => {
    const projectId = await createProject("history generations");
    const itemId = await createItem(projectId, "世代0");
    const checkpoint = await owner.rpc("create_entity_checkpoint", {
      p_project_id: projectId,
      p_entity_type: "timeline_item",
      p_entity_id: itemId,
    });
    expect(checkpoint.error).toBeNull();
    expect(checkpoint.data?.is_checkpoint).toBe(true);

    for (let index = 1; index <= 22; index += 1) {
      const update = await owner
        .from("timeline_items")
        .update({ title: `世代${index}` })
        .eq("id", itemId);
      if (update.error) throw update.error;
    }
    const history = await owner
      .from("entity_history")
      .select("revision")
      .eq("entity_id", itemId)
      .order("revision", { ascending: false });
    expect(history.error).toBeNull();
    expect(history.data).toHaveLength(20);
    expect(history.data?.[0]?.revision).toBe(23);
    expect(history.data?.at(-1)?.revision).toBe(4);
  });

  it("bounds large text history by generation and keeps its serialized delta below one MiB", async () => {
    const projectId = await createProject("large history capacity");
    const itemId = await createItem(projectId, "大規模履歴");
    for (let index = 1; index <= 22; index += 1) {
      const update = await owner
        .from("timeline_items")
        .update({ description: `${index}:${"歴史".repeat(3_100)}` })
        .eq("id", itemId);
      if (update.error) throw update.error;
    }
    const history = await owner
      .from("entity_history")
      .select("changes")
      .eq("entity_id", itemId);
    expect(history.error).toBeNull();
    expect(history.data).toHaveLength(20);
    const serializedBytes = Buffer.byteLength(
      JSON.stringify(history.data),
      "utf8",
    );
    expect(serializedBytes).toBeLessThan(1024 * 1024);
  });

  it("trashes and restores an item with its child event without exposing deleted public data", async () => {
    const projectId = await createProject("trash restore");
    const itemId = await createItem(projectId, "ゴミ箱対象");
    const event = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: itemId,
        title: "子イベント",
        event_year: 1920,
      })
      .select("id")
      .single();
    if (event.error) throw event.error;
    await owner
      .from("projects")
      .update({ visibility: "public" })
      .eq("id", projectId);

    const trashed = await owner.rpc("trash_timeline_item", {
      p_project_id: projectId,
      p_item_id: itemId,
    });
    expect(trashed.error).toBeNull();
    expect(trashed.data).toBe(true);

    const [ownerItem, ownerEvent, otherItem, anonymousEvent, searchDocument] =
      await Promise.all([
        owner
          .from("timeline_items")
          .select("deleted_at")
          .eq("id", itemId)
          .single(),
        owner
          .from("timeline_events")
          .select("deleted_at")
          .eq("id", event.data.id)
          .single(),
        otherUser.from("timeline_items").select("id").eq("id", itemId),
        anonymous.from("timeline_events").select("id").eq("id", event.data.id),
        admin
          .from("search_documents")
          .select("entity_id")
          .in("entity_id", [itemId, event.data.id]),
      ]);
    expect(ownerItem.data?.deleted_at).not.toBeNull();
    expect(ownerEvent.data?.deleted_at).not.toBeNull();
    expect(otherItem.data).toEqual([]);
    expect(anonymousEvent.data).toEqual([]);
    expect(searchDocument.data).toEqual([]);

    const restored = await owner.rpc("restore_trashed_entity", {
      p_project_id: projectId,
      p_entity_type: "timeline_item",
      p_entity_id: itemId,
    });
    expect(restored.error).toBeNull();
    expect(restored.data).toBe(true);
    const restoredRows = await Promise.all([
      owner
        .from("timeline_items")
        .select("deleted_at")
        .eq("id", itemId)
        .single(),
      owner
        .from("timeline_events")
        .select("deleted_at")
        .eq("id", event.data.id)
        .single(),
    ]);
    expect(restoredRows[0].data?.deleted_at).toBeNull();
    expect(restoredRows[1].data?.deleted_at).toBeNull();
  });

  it("denies history and trash operations to other users and anonymous clients", async () => {
    const projectId = await createProject("history RLS");
    const itemId = await createItem(projectId, "非公開履歴");
    await owner
      .from("timeline_items")
      .update({ title: "所有者の更新" })
      .eq("id", itemId);

    const [otherHistory, anonymousHistory, otherTrash, anonymousCheckpoint] =
      await Promise.all([
        otherUser.from("entity_history").select("id").eq("entity_id", itemId),
        anonymous.from("entity_history").select("id").eq("entity_id", itemId),
        otherUser.rpc("trash_timeline_item", {
          p_project_id: projectId,
          p_item_id: itemId,
        }),
        anonymous.rpc("create_entity_checkpoint", {
          p_project_id: projectId,
          p_entity_type: "timeline_item",
          p_entity_id: itemId,
        }),
      ]);
    expect(otherHistory.data).toEqual([]);
    expect(anonymousHistory.error).not.toBeNull();
    expect(otherTrash.error).not.toBeNull();
    expect(anonymousCheckpoint.error).not.toBeNull();
  });

  it("permanently removes trash after the retention cleanup threshold", async () => {
    const projectId = await createProject("trash retention cleanup");
    const itemId = await createItem(projectId, "期限切れゴミ箱");
    const historyItemId = await createItem(projectId, "期限切れ履歴");
    const saved = await owner
      .from("timeline_items")
      .update({ title: "期限切れ履歴の更新版" })
      .eq("id", historyItemId);
    expect(saved.error).toBeNull();
    const trashed = await owner.rpc("trash_timeline_item", {
      p_project_id: projectId,
      p_item_id: itemId,
    });
    expect(trashed.error).toBeNull();
    const age = await admin
      .from("timeline_items")
      .update({ deleted_at: "2026-01-01T00:00:00.000Z" })
      .eq("id", itemId);
    expect(age.error).toBeNull();
    const ageHistory = await admin
      .from("entity_history")
      .update({ created_at: "2026-01-01T00:00:00.000Z" })
      .eq("entity_id", historyItemId);
    expect(ageHistory.error).toBeNull();
    const cleanup = await admin.rpc("run_timeline_retention_cleanup");
    expect(cleanup.error).toBeNull();
    const [remainingTrash, remainingHistory] = await Promise.all([
      admin.from("timeline_items").select("id").eq("id", itemId),
      admin.from("entity_history").select("id").eq("entity_id", historyItemId),
    ]);
    expect(remainingTrash.data).toEqual([]);
    expect(remainingHistory.data).toEqual([]);
  });
});
