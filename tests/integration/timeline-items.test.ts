import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { emptyTimelineItemValues } from "@/features/timeline-items/validation";
import { TimelineItemService } from "@/lib/services/timeline-item-service";

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

const ownerEmail = `timeline-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `timeline-other-${crypto.randomUUID()}@example.com`;
const password = `Timeline-${crypto.randomUUID()}`;
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

async function firstType(projectId: string) {
  const { data, error } = await owner
    .from("timeline_item_types")
    .select("id")
    .eq("project_id", projectId)
    .order("sort_order")
    .limit(1)
    .single();
  if (error) throw error;
  return data.id;
}

function rangeRow(projectId: string, typeId: string, title: string, order = 0) {
  return {
    project_id: projectId,
    type_id: typeId,
    title,
    temporal_type: "range",
    manual_order: order,
    start_year: 1867,
    start_month: 2,
    start_day: 9,
    is_start_approximate: true,
    end_date_status: "specified",
    end_year: 1916,
    end_month: 12,
    end_day: 9,
    is_end_approximate: false,
    is_point_approximate: false,
  };
}

describe("timeline item persistence and RLS", () => {
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

  it("rejects an update based on a stale item version", async () => {
    const projectId = await createProject("optimistic item locking");
    const typeId = await firstType(projectId);
    const service = new TimelineItemService(owner);
    const values = {
      ...emptyTimelineItemValues(typeId),
      title: "競合前",
      start: { year: 1900, month: null, day: null },
      end: { year: 1910, month: null, day: null },
    };
    const created = await service.create(projectId, values);
    const staleVersion = created.item.updatedAt;

    await service.update(projectId, created.item.id, {
      values: { ...values, title: "先に保存した変更" },
      expectedUpdatedAt: staleVersion,
    });

    await expect(
      service.update(projectId, created.item.id, {
        values: { ...values, title: "遅れて保存した変更" },
        expectedUpdatedAt: staleVersion,
      }),
    ).rejects.toMatchObject({
      code: "TIMELINE_ITEM_CONFLICT",
      status: 409,
    });
  });

  it("stores range, ongoing, unknown, and point shapes", async () => {
    const projectId = await createProject("date shapes");
    const typeId = await firstType(projectId);
    const { error } = await owner.from("timeline_items").insert([
      rangeRow(projectId, typeId, "specified", 0),
      {
        ...rangeRow(projectId, typeId, "ongoing", 1),
        end_date_status: "ongoing",
        end_year: null,
        end_month: null,
        end_day: null,
      },
      {
        ...rangeRow(projectId, typeId, "unknown", 2),
        end_date_status: "unknown",
        end_year: 1910,
        end_month: null,
        end_day: null,
      },
      {
        project_id: projectId,
        type_id: typeId,
        title: "point",
        temporal_type: "point",
        manual_order: 3,
        start_year: 1905,
        start_month: 1,
        start_day: 1,
        is_point_approximate: true,
        is_start_approximate: false,
        is_end_approximate: false,
      },
    ]);
    expect(error).toBeNull();

    const { data, error: readError } = await owner
      .from("timeline_items")
      .select("title, temporal_type, end_date_status, start_year, end_year")
      .eq("project_id", projectId)
      .order("manual_order");
    expect(readError).toBeNull();
    expect(data?.map((item) => item.title)).toEqual([
      "specified",
      "ongoing",
      "unknown",
      "point",
    ]);
  });

  it("enforces date, temporal shape, ordering, and same-project type constraints", async () => {
    const firstProject = await createProject("constraints one");
    const secondProject = await createProject("constraints two");
    const firstTypeId = await firstType(firstProject);
    const secondTypeId = await firstType(secondProject);

    const impossible = await owner.from("timeline_items").insert({
      ...rangeRow(firstProject, firstTypeId, "impossible"),
      start_year: 1900,
      start_month: 2,
      start_day: 29,
    });
    expect(impossible.error?.code).toBe("23514");

    const reversed = await owner.from("timeline_items").insert({
      ...rangeRow(firstProject, firstTypeId, "reversed"),
      start_year: 2000,
    });
    expect(reversed.error?.code).toBe("23514");

    const invalidOngoing = await owner.from("timeline_items").insert({
      ...rangeRow(firstProject, firstTypeId, "invalid ongoing"),
      end_date_status: "ongoing",
    });
    expect(invalidOngoing.error?.code).toBe("23514");

    const crossProjectType = await owner
      .from("timeline_items")
      .insert(rangeRow(firstProject, secondTypeId, "cross-project type"));
    expect(crossProjectType.error?.code).toBe("23503");
  });

  it("stores BCE centuries and normalized ranges without weakening RLS", async () => {
    const projectId = await createProject("BCE normalized ranges");
    const typeId = await firstType(projectId);
    const created = await owner
      .from("timeline_items")
      .insert({
        ...rangeRow(projectId, typeId, "紀元前から西暦"),
        start_era: "bce",
        start_precision: "century",
        start_year: 5,
        start_month: null,
        start_day: null,
        start_original_text: "第五世紀頃",
        end_era: "ce",
        end_precision: "decade",
        end_year: 10,
        end_month: null,
        end_day: null,
      })
      .select(
        "id, start_normalized_min, start_normalized_max, end_normalized_max",
      )
      .single();
    expect(created.error).toBeNull();
    expect(created.data!.start_normalized_min).toBeLessThan(
      created.data!.start_normalized_max!,
    );
    expect(created.data!.start_normalized_max).toBeLessThan(
      created.data!.end_normalized_max!,
    );
    const invalidDecade = await owner.from("timeline_items").insert({
      ...rangeRow(projectId, typeId, "invalid decade", 1),
      start_precision: "decade",
      start_year: 1861,
      start_month: null,
      start_day: null,
    });
    expect(invalidDecade.error?.code).toBe("23514");

    const bceLeapDay = await owner.from("timeline_items").insert({
      ...rangeRow(projectId, typeId, "BCE leap day", 2),
      start_era: "bce",
      start_precision: "day",
      start_year: 1,
      start_month: 2,
      start_day: 29,
    });
    expect(bceLeapDay.error).toBeNull();

    const invalidBceLeapDay = await owner.from("timeline_items").insert({
      ...rangeRow(projectId, typeId, "invalid BCE leap day", 3),
      start_era: "bce",
      start_precision: "day",
      start_year: 2,
      start_month: 2,
      start_day: 29,
    });
    expect(invalidBceLeapDay.error?.code).toBe("23514");

    const [otherRead, anonymousRead] = await Promise.all([
      otherUser.from("timeline_items").select("id").eq("id", created.data!.id),
      anonymous.from("timeline_items").select("id").eq("id", created.data!.id),
    ]);
    expect(otherRead.data).toEqual([]);
    expect(anonymousRead.data).toEqual([]);
  });

  it("keeps the parent and successful siblings when individual event inserts fail", async () => {
    const projectId = await createProject("partial child events");
    const typeId = await firstType(projectId);
    const { data, error } = await owner.rpc(
      "create_timeline_item_with_events",
      {
        p_project_id: projectId,
        p_item: rangeRow(projectId, typeId, "parent with partial events"),
        p_events: [
          {
            title: "成功イベント",
            event_year: 1905,
            event_month: 1,
            event_day: 15,
            is_approximate: false,
          },
          {
            title: "不正日付イベント",
            event_year: 1905,
            event_month: 2,
            event_day: 30,
            is_approximate: false,
          },
          {
            title: "",
            event_year: 1906,
            is_approximate: false,
          },
        ],
      },
    );
    expect(error).toBeNull();
    expect(data?.[0]?.created_event_ids).toHaveLength(1);
    expect(data?.[0]?.failed_events).toEqual([
      {
        title: "不正日付イベント",
        reason: "入力内容がデータベース制約を満たしていません。",
      },
      {
        title: "タイトル未入力",
        reason: "入力内容がデータベース制約を満たしていません。",
      },
    ]);

    const [{ data: items }, { data: events }] = await Promise.all([
      owner
        .from("timeline_items")
        .select("id, title")
        .eq("project_id", projectId),
      owner.from("timeline_events").select("title").eq("project_id", projectId),
    ]);
    expect(items).toEqual([
      expect.objectContaining({ title: "parent with partial events" }),
    ]);
    expect(events).toEqual([{ title: "成功イベント" }]);
  });

  it("creates a point parent while reporting all child events as failed", async () => {
    const projectId = await createProject("point parent batch");
    const typeId = await firstType(projectId);
    const { data, error } = await owner.rpc(
      "create_timeline_item_with_events",
      {
        p_project_id: projectId,
        p_item: {
          project_id: projectId,
          type_id: typeId,
          title: "時点の親",
          temporal_type: "point",
          manual_order: 0,
          start_year: 1905,
          is_point_approximate: false,
          is_start_approximate: false,
          is_end_approximate: false,
        },
        p_events: [
          {
            title: "作成不可イベント",
            event_year: 1905,
            is_approximate: false,
          },
        ],
      },
    );
    expect(error).toBeNull();
    expect(data?.[0]?.created_event_ids).toEqual([]);
    expect(data?.[0]?.failed_events).toEqual([
      {
        title: "作成不可イベント",
        reason: "入力内容がデータベース制約を満たしていません。",
      },
    ]);
    const { data: parent } = await owner
      .from("timeline_items")
      .select("title, temporal_type")
      .eq("project_id", projectId)
      .single();
    expect(parent).toEqual({ title: "時点の親", temporal_type: "point" });
  });

  it("does not let another user or an anonymous client create a batch", async () => {
    const projectId = await createProject("batch RLS");
    const typeId = await firstType(projectId);
    const args = {
      p_project_id: projectId,
      p_item: rangeRow(projectId, typeId, "forbidden parent"),
      p_events: [],
    };
    const [otherResult, anonymousResult] = await Promise.all([
      otherUser.rpc("create_timeline_item_with_events", args),
      anonymous.rpc("create_timeline_item_with_events", args),
    ]);
    expect(otherResult.error).not.toBeNull();
    expect(anonymousResult.error).not.toBeNull();
    const { data } = await owner
      .from("timeline_items")
      .select("id")
      .eq("project_id", projectId);
    expect(data).toEqual([]);
  });

  it("allows only the owner to read and write timeline items", async () => {
    const projectId = await createProject("private items");
    const typeId = await firstType(projectId);
    const { data: created, error } = await owner
      .from("timeline_items")
      .insert(rangeRow(projectId, typeId, "private"))
      .select("id")
      .single();
    if (error) throw error;

    const [otherRead, anonymousRead, otherUpdate, otherDelete] =
      await Promise.all([
        otherUser.from("timeline_items").select("id").eq("id", created.id),
        anonymous.from("timeline_items").select("id").eq("id", created.id),
        otherUser
          .from("timeline_items")
          .update({ title: "stolen" })
          .eq("id", created.id)
          .select("id"),
        otherUser
          .from("timeline_items")
          .delete()
          .eq("id", created.id)
          .select("id"),
      ]);

    expect(otherRead.error).toBeNull();
    expect(otherRead.data).toEqual([]);
    expect(anonymousRead.error).toBeNull();
    expect(anonymousRead.data).toEqual([]);
    expect(otherUpdate.data).toEqual([]);
    expect(otherDelete.data).toEqual([]);
  });

  it("persists manual movement and type changes while protecting used types", async () => {
    const projectId = await createProject("manual order");
    const { data: types, error: typesError } = await owner
      .from("timeline_item_types")
      .select("id")
      .eq("project_id", projectId)
      .order("sort_order")
      .limit(2);
    if (typesError) throw typesError;
    const firstTypeId = types?.[0]?.id;
    const secondTypeId = types?.[1]?.id;
    if (!firstTypeId || !secondTypeId) throw new Error("Types are required.");

    const { data: items, error } = await owner
      .from("timeline_items")
      .insert([
        rangeRow(projectId, firstTypeId, "first", 0),
        rangeRow(projectId, firstTypeId, "second", 1),
        rangeRow(projectId, firstTypeId, "third", 2),
      ])
      .select("id, manual_order")
      .order("manual_order");
    if (error) throw error;
    const thirdId = items?.[2]?.id;
    if (!thirdId) throw new Error("Third item is required.");

    const { error: moveError } = await owner.rpc("move_timeline_item", {
      p_project_id: projectId,
      p_item_id: thirdId,
      p_new_position: 0,
      p_new_type_id: secondTypeId,
    });
    expect(moveError).toBeNull();

    const { data: moved } = await owner
      .from("timeline_items")
      .select("id, type_id, manual_order")
      .eq("project_id", projectId)
      .order("manual_order");
    expect(moved?.[0]).toMatchObject({
      id: thirdId,
      type_id: secondTypeId,
      manual_order: 0,
    });
    expect(moved?.map((item) => item.manual_order)).toEqual([0, 1, 2]);

    const usedTypeDelete = await owner
      .from("timeline_item_types")
      .delete()
      .eq("id", secondTypeId);
    expect(usedTypeDelete.error?.code).toBe("23503");
  });

  it("indexes aliases and internal links while hiding private targets", async () => {
    const projectId = await createProject("internal links");
    const typeId = await firstType(projectId);
    const { data: items, error } = await owner
      .from("timeline_items")
      .insert([
        {
          ...rangeRow(projectId, typeId, "同名候補", 0),
          aliases: ["本名候補"],
        },
        {
          ...rangeRow(projectId, typeId, "参照元", 1),
          aliases: [],
        },
      ])
      .select("id, title");
    if (error || !items?.[0] || !items[1]) throw error ?? new Error("items");
    const target = items.find((item) => item.title === "同名候補")!;
    const source = items.find((item) => item.title === "参照元")!;
    const { data: event, error: eventError } = await owner
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: source.id,
        title: "同名候補",
        aliases: ["出来事候補"],
        event_year: 1905,
      })
      .select("id")
      .single();
    if (eventError) throw eventError;

    const linked = await owner
      .from("timeline_items")
      .update({ description: `[[item:${target.id}|同名候補]]` })
      .eq("id", source.id);
    expect(linked.error).toBeNull();

    const candidates = await owner.rpc("get_internal_link_candidates", {
      p_project_id: projectId,
      p_query: "候補",
    });
    expect(candidates.error).toBeNull();
    expect(
      candidates.data?.map((row: { entity_type: string }) => row.entity_type),
    ).toEqual(["event", "item"]);
    expect(
      candidates.data?.find(
        (row: { entity_type: string; parent_title: string | null }) =>
          row.entity_type === "event",
      )?.parent_title,
    ).toBe("参照元");

    const aliasCandidate = await owner.rpc("get_internal_link_candidates", {
      p_project_id: projectId,
      p_query: "本名候補",
    });
    expect(
      aliasCandidate.data?.map((row: { entity_id: string }) => row.entity_id),
    ).toEqual([target.id]);

    const [ownerLinks, otherLinks, anonymousLinks] = await Promise.all([
      owner.from("internal_links").select("target_entity_id"),
      otherUser.from("internal_links").select("target_entity_id"),
      anonymous.from("internal_links").select("target_entity_id"),
    ]);
    expect(ownerLinks.data).toContainEqual({ target_entity_id: target.id });
    expect(otherLinks.data).toEqual([]);
    expect(anonymousLinks.data).toBeNull();
    expect(anonymousLinks.error?.code).toBe("42501");

    const renamed = await owner
      .from("timeline_items")
      .update({ title: "変更後名称" })
      .eq("id", target.id);
    expect(renamed.error).toBeNull();
    const resolved = await owner.rpc("resolve_internal_links", {
      p_project_id: projectId,
      p_item_ids: [target.id],
      p_event_ids: [event.id],
    });
    expect(resolved.data).toContainEqual({
      entity_type: "item",
      entity_id: target.id,
      title: "変更後名称",
    });

    const trashed = await owner.rpc("trash_timeline_item", {
      p_project_id: projectId,
      p_item_id: target.id,
    });
    expect(trashed.error).toBeNull();
    const broken = await owner.rpc("resolve_internal_links", {
      p_project_id: projectId,
      p_item_ids: [target.id],
      p_event_ids: [],
    });
    expect(broken.data).toEqual([]);
    const references = await owner
      .from("internal_links")
      .select("source_entity_id")
      .eq("target_entity_id", target.id);
    expect(references.data).toEqual([{ source_entity_id: source.id }]);

    const duplicateAliases = await owner
      .from("timeline_events")
      .update({ aliases: ["重複", "重複"] })
      .eq("id", event.id);
    expect(duplicateAliases.error?.code).toBe("23514");
  });

  it("cascades timeline items when deleting their project", async () => {
    const projectId = await createProject("cascade items");
    const typeId = await firstType(projectId);
    const { error } = await owner
      .from("timeline_items")
      .insert(rangeRow(projectId, typeId, "cascade"));
    if (error) throw error;

    await owner.from("projects").delete().eq("id", projectId);
    const { data } = await admin
      .from("timeline_items")
      .select("id")
      .eq("project_id", projectId);
    expect(data).toEqual([]);
  });
});
