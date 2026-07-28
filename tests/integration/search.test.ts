import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";
import type { Database } from "@/lib/supabase/database.types";

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
const ownerEmail = `search-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `search-other-${crypto.randomUUID()}@example.com`;
const password = `Search-${crypto.randomUUID()}`;
let ownerId = "";
let otherId = "";

async function createProject(name: string) {
  const { data, error } = await owner.rpc("create_project_with_settings", {
    p_name: name,
    p_description: "近代日本文学の検索対象",
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

describe("PGroonga search synchronization and RLS", () => {
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
    const [ownerSession, otherSession] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password }),
      other.auth.signInWithPassword({ email: otherEmail, password }),
    ]);
    if (
      ownerSession.error ||
      otherSession.error ||
      !ownerSession.data.session ||
      !otherSession.data.session
    ) {
      throw new Error("Authenticated sessions are required.");
    }
    await Promise.all([
      waitUntilAccessTokenIsCurrent(ownerSession.data.session.access_token),
      waitUntilAccessTokenIsCurrent(otherSession.data.session.access_token),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      admin.auth.admin.deleteUser(ownerId),
      admin.auth.admin.deleteUser(otherId),
    ]);
  });

  it("searches Japanese item and event content and synchronizes type changes", async () => {
    const projectId = await createProject("日本文学史");
    const { data: itemType, error: typeError } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .single();
    if (typeError) throw typeError;
    const { data: item, error: itemError } = await owner
      .from("timeline_items")
      .insert({
        project_id: projectId,
        type_id: itemType.id,
        title: "夏目漱石",
        aliases: ["夏目金之助", "漱石"],
        description: "# 明治時代の**小説家**",
        source_text: "文学史資料",
        temporal_type: "range",
        manual_order: 0,
        start_year: 1867,
        end_date_status: "specified",
        end_year: 1916,
      })
      .select("id")
      .single();
    if (itemError) throw itemError;
    const { data: event, error: eventError } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: item.id,
        title: "代表作刊行",
        description:
          "> [!NOTE]\n> [吾輩は猫である](https://example.com/cat)を発表",
        event_year: 1905,
      })
      .select("id")
      .single();
    if (eventError) throw eventError;

    const indexedMarkdown = await admin
      .from("search_documents")
      .select("entity_id, content")
      .in("entity_id", [item.id, event.id]);
    expect(indexedMarkdown.error).toBeNull();
    const itemContent = indexedMarkdown.data?.find(
      (row) => row.entity_id === item.id,
    )?.content;
    const eventContent = indexedMarkdown.data?.find(
      (row) => row.entity_id === event.id,
    )?.content;
    expect(itemContent).toContain("明治時代の 小説家");
    expect(itemContent).not.toContain("**");
    expect(eventContent).toContain("吾輩は猫である");
    expect(eventContent).not.toContain("[!NOTE]");
    expect(eventContent).not.toContain("https://example.com/cat");

    const itemSearch = await owner.rpc("search_global_documents", {
      p_query: "漱石",
      p_page: 1,
      p_page_size: 20,
    });
    const aliasSearch = await owner.rpc("search_global_documents", {
      p_query: "夏目金之助",
      p_page: 1,
      p_page_size: 20,
    });
    expect(aliasSearch.error).toBeNull();
    expect(aliasSearch.data?.map((row) => row.entity_id)).toContain(item.id);
    expect(itemSearch.error).toBeNull();
    expect(itemSearch.data?.some((row) => row.entity_id === item.id)).toBe(
      true,
    );

    const eventMatch = await owner.rpc("match_project_search_documents", {
      p_project_id: projectId,
      p_query: "吾輩は猫である",
    });
    expect(eventMatch.data).toContainEqual({
      entity_type: "timeline_event",
      entity_id: event.id,
    });

    await owner
      .from("timeline_item_types")
      .update({ name: "文豪" })
      .eq("id", itemType.id);
    const typeSearch = await owner.rpc("search_global_documents", {
      p_query: "文豪",
      p_page: 1,
      p_page_size: 20,
    });
    expect(typeSearch.data?.map((row) => row.entity_id)).toEqual(
      expect.arrayContaining([item.id, event.id]),
    );

    await owner.from("timeline_events").delete().eq("id", event.id);
    const deletedSearch = await owner.rpc("search_global_documents", {
      p_query: "吾輩は猫である",
      p_page: 1,
      p_page_size: 20,
    });
    expect(deletedSearch.data).toEqual([]);
  });

  it("prevents private leakage, exposes public documents, and denies direct writes", async () => {
    const projectId = await createProject("機密思想史");
    const ownerResults = await owner.rpc("search_global_documents", {
      p_query: "機密思想史",
      p_page: 1,
      p_page_size: 20,
    });
    expect(ownerResults.data?.map((row) => row.project_id)).toContain(
      projectId,
    );

    for (const client of [other, anonymous]) {
      const privateResults = await client.rpc("search_global_documents", {
        p_query: "機密思想史",
        p_page: 1,
        p_page_size: 20,
      });
      expect(privateResults.error).toBeNull();
      expect(privateResults.data?.map((row) => row.project_id)).not.toContain(
        projectId,
      );
    }

    const forbiddenWrite = await owner
      .from("search_documents")
      .update({ title: "改ざん" })
      .eq("entity_id", projectId);
    expect(forbiddenWrite.error?.code).toBe("42501");

    const publish = await admin
      .from("projects")
      .update({
        visibility: "public",
        public_id: crypto.randomUUID().replaceAll("-", ""),
        published_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (publish.error) throw publish.error;

    for (const client of [other, anonymous]) {
      const publicResults = await client.rpc("search_global_documents", {
        p_query: "機密思想史",
        p_page: 1,
        p_page_size: 20,
      });
      expect(publicResults.error).toBeNull();
      expect(publicResults.data?.map((row) => row.entity_id)).toContain(
        projectId,
      );
    }
  });
});
