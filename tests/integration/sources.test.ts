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
const password = `Sources-${crypto.randomUUID()}`;
let ownerId = "";
let otherId = "";

async function project(name: string) {
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

describe("structured sources", () => {
  beforeAll(async () => {
    const ownerEmail = `sources-owner-${crypto.randomUUID()}@example.com`;
    const otherEmail = `sources-other-${crypto.randomUUID()}@example.com`;
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
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherId),
    ]);
  });

  it("reuses one source across an item and event with individual locators", async () => {
    const projectId = await project("出典統合");
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    const { data: item, error: itemError } = await owner
      .from("timeline_items")
      .insert({
        project_id: projectId,
        type_id: type!.id,
        title: "人物",
        temporal_type: "range",
        manual_order: 0,
        start_year: 1900,
        end_date_status: "specified",
        end_year: 1950,
        source_text: "従来の自由記述",
      })
      .select("id")
      .single();
    if (itemError) throw itemError;
    const { data: event, error: eventError } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: item.id,
        title: "出来事",
        event_year: 1910,
      })
      .select("id")
      .single();
    if (eventError) throw eventError;
    const { data: source, error: sourceError } = await owner
      .from("sources")
      .insert({
        project_id: projectId,
        title: "共通資料",
        authors: ["著者A"],
        citation_key: "common1910",
      })
      .select("id")
      .single();
    if (sourceError) throw sourceError;
    const { error } = await owner.from("source_citations").insert([
      {
        project_id: projectId,
        source_id: source.id,
        entity_type: "timeline_item",
        entity_id: item.id,
        pages: "10-12",
      },
      {
        project_id: projectId,
        source_id: source.id,
        entity_type: "timeline_event",
        entity_id: event.id,
        chapter: "第2章",
      },
    ]);
    expect(error).toBeNull();
    const { data: links } = await owner
      .from("source_citations")
      .select("source_id, pages, chapter")
      .eq("source_id", source.id);
    expect(links).toHaveLength(2);
    expect(links).toContainEqual(expect.objectContaining({ pages: "10-12" }));
    const { data: storedItem } = await owner
      .from("timeline_items")
      .select("source_text")
      .eq("id", item.id)
      .single();
    expect(storedItem?.source_text).toBe("従来の自由記述");
  });

  it("enforces project ownership and exposes read-only citations for public projects", async () => {
    const projectId = await project("公開出典");
    const { data: source, error } = await owner
      .from("sources")
      .insert({ project_id: projectId, title: "公開資料" })
      .select("id")
      .single();
    if (error) throw error;
    const privateReads = await Promise.all([
      other.from("sources").select("id").eq("project_id", projectId),
      anonymous.from("sources").select("id").eq("project_id", projectId),
    ]);
    expect(privateReads[0].data).toEqual([]);
    expect(privateReads[1].data).toEqual([]);
    const invalidWrite = await other
      .from("sources")
      .insert({ project_id: projectId, title: "不正" });
    expect(invalidWrite.error).not.toBeNull();
    const { error: publishError } = await owner.rpc("publish_project", {
      p_project_id: projectId,
    });
    expect(publishError).toBeNull();
    const [otherRead, anonymousRead] = await Promise.all([
      other.from("sources").select("id").eq("id", source.id),
      anonymous.from("sources").select("id").eq("id", source.id),
    ]);
    expect(otherRead.data).toEqual([{ id: source.id }]);
    expect(anonymousRead.data).toEqual([{ id: source.id }]);
    const publicWrite = await other
      .from("sources")
      .update({ title: "改ざん" })
      .eq("id", source.id)
      .select("id");
    expect(publicWrite.error).toBeNull();
    expect(publicWrite.data).toEqual([]);
    const { data: unchanged } = await owner
      .from("sources")
      .select("title")
      .eq("id", source.id)
      .single();
    expect(unchanged?.title).toBe("公開資料");
  });

  it("rejects cross-project citations and duplicate citation keys", async () => {
    const first = await project("第一");
    const second = await project("第二");
    const { data: source } = await owner
      .from("sources")
      .insert({ project_id: first, title: "資料", citation_key: "same" })
      .select("id")
      .single();
    const duplicate = await owner
      .from("sources")
      .insert({ project_id: first, title: "別資料", citation_key: "SAME" });
    expect(duplicate.error?.code).toBe("23505");
    const unsafeUrl = await owner.from("sources").insert({
      project_id: first,
      title: "危険なURL",
      url: "javascript:alert(1)",
    });
    expect(unsafeUrl.error?.code).toBe("23514");
    const { data: type } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", second)
      .limit(1)
      .single();
    const { data: item } = await owner
      .from("timeline_items")
      .insert({
        project_id: second,
        type_id: type!.id,
        title: "別項目",
        temporal_type: "point",
        manual_order: 0,
        start_year: 2000,
      })
      .select("id")
      .single();
    const cross = await owner.from("source_citations").insert({
      project_id: second,
      source_id: source!.id,
      entity_type: "timeline_item",
      entity_id: item!.id,
    });
    expect(cross.error?.code).toBe("23503");
  });
});
