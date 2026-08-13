import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";
import {
  buildNetworkEdges,
  buildNetworkNodes,
} from "@/features/relationship-network/network-model";
import { RelationshipService } from "@/lib/services/relationship-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";

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
const password = `L14-${crypto.randomUUID()}`;
const ownerEmail = `l14-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `l14-other-${crypto.randomUUID()}@example.com`;
let ownerId = "";
let otherId = "";

async function createProject(name: string) {
  const result = await owner.rpc("create_project_with_settings", {
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
  if (result.error) throw result.error;
  return result.data as string;
}

async function createEndpoints(projectId: string) {
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
      title: "関係元",
      start_year: 1900,
      start_month: 1,
      start_day: 1,
      temporal_type: "range",
      end_date_status: "specified",
      end_year: 1910,
      end_month: 1,
      end_day: 1,
      manual_order: 0,
    })
    .select("id")
    .single();
  if (item.error) throw item.error;
  const event = await owner
    .from("timeline_events")
    .insert({
      project_id: projectId,
      timeline_item_id: item.data.id,
      title: "関係先",
      event_year: 1905,
      event_month: 1,
      event_day: 1,
    })
    .select("id")
    .single();
  if (event.error) throw event.error;
  return { itemId: item.data.id, eventId: event.data.id };
}

describe("Phase L14 semantic relationship RLS and constraints", () => {
  beforeAll(async () => {
    const [a, b] = await Promise.all([
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
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    ownerId = a.data.user.id;
    otherId = b.data.user.id;
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

  it("stores Japanese custom types and line endpoint styles for every entity combination", async () => {
    const projectId = await createProject("意味的関係");
    const { itemId, eventId } = await createEndpoints(projectId);
    const created = await owner
      .from("entity_relationships")
      .insert({
        project_id: projectId,
        source_type: "timeline_item",
        source_id: itemId,
        target_type: "timeline_event",
        target_id: eventId,
        relation_type: "翻案・再構成",
        direction: "directed",
        line_style: "double",
        source_marker: "arrow",
        target_marker: "arrow",
      })
      .select(
        "id, relation_type, direction, line_style, source_marker, target_marker",
      )
      .single();
    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({
      relation_type: "翻案・再構成",
      direction: "directed",
      line_style: "double",
      source_marker: "arrow",
      target_marker: "arrow",
    });

    const second = await createEndpoints(projectId);
    const combinations = await owner.from("entity_relationships").insert([
      {
        project_id: projectId,
        source_type: "timeline_item",
        source_id: itemId,
        target_type: "timeline_item",
        target_id: second.itemId,
        relation_type: "影響",
      },
      {
        project_id: projectId,
        source_type: "timeline_event",
        source_id: eventId,
        target_type: "timeline_item",
        target_id: second.itemId,
        relation_type: "協働",
      },
      {
        project_id: projectId,
        source_type: "timeline_event",
        source_id: eventId,
        target_type: "timeline_event",
        target_id: second.eventId,
        relation_type: "対立",
      },
    ]);
    expect(combinations.error).toBeNull();
    expect(
      (
        await owner
          .from("entity_relationships")
          .select("id")
          .eq("project_id", projectId)
      ).data,
    ).toHaveLength(4);

    const self = await owner.from("entity_relationships").insert({
      project_id: projectId,
      source_type: "timeline_item",
      source_id: itemId,
      target_type: "timeline_item",
      target_id: itemId,
      relation_type: "影響",
    });
    expect(self.error?.code).toBe("23514");
  });

  it("allows only owners to write and only exposes published project relations", async () => {
    const projectId = await createProject("関係RLS");
    const { itemId, eventId } = await createEndpoints(projectId);
    const relation = await owner
      .from("entity_relationships")
      .insert({
        project_id: projectId,
        source_type: "timeline_item",
        source_id: itemId,
        target_type: "timeline_event",
        target_id: eventId,
        relation_type: "影響",
      })
      .select("id")
      .single();
    expect(relation.error).toBeNull();

    expect(
      (
        await other
          .from("entity_relationships")
          .select("id")
          .eq("project_id", projectId)
      ).data,
    ).toEqual([]);
    expect(
      (
        await anonymous
          .from("entity_relationships")
          .select("id")
          .eq("project_id", projectId)
      ).data,
    ).toEqual([]);
    expect(
      (
        await other
          .from("entity_relationships")
          .update({ note: "侵入" })
          .eq("id", relation.data!.id)
          .select("id")
      ).data,
    ).toEqual([]);

    expect(
      (
        await owner
          .from("projects")
          .update({
            visibility: "public",
            public_id: crypto.randomUUID().replaceAll("-", ""),
            published_at: new Date().toISOString(),
          })
          .eq("id", projectId)
      ).error,
    ).toBeNull();
    expect(
      (
        await anonymous
          .from("entity_relationships")
          .select("relation_type")
          .eq("project_id", projectId)
      ).data,
    ).toEqual([{ relation_type: "影響" }]);
  });

  it("feeds the L15 network model from the owner-scoped services without stored positions", async () => {
    const projectId = await createProject("関連ネットワーク");
    const { itemId, eventId } = await createEndpoints(projectId);
    const inserted = await owner.from("entity_relationships").insert({
      project_id: projectId,
      source_type: "timeline_item",
      source_id: itemId,
      target_type: "timeline_event",
      target_id: eventId,
      relation_type: "影響",
      direction: "directed",
      line_style: "double",
      target_marker: "arrow",
    });
    if (inserted.error) throw inserted.error;

    const [listing, events, dataset] = await Promise.all([
      new TimelineItemService(owner).list(projectId),
      new TimelineEventService(owner).list(projectId),
      new RelationshipService(owner).list(projectId),
    ]);
    const nodes = buildNetworkNodes(listing.items, events);
    const edges = buildNetworkEdges(dataset.relationships);

    expect(nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        `timeline_item:${itemId}`,
        `timeline_event:${eventId}`,
      ]),
    );
    expect(edges).toEqual([
      expect.objectContaining({
        source: `timeline_item:${itemId}`,
        target: `timeline_event:${eventId}`,
        lineStyle: "double",
        targetMarker: "arrow",
      }),
    ]);
    expect(nodes.every((node) => !("x" in node) && !("y" in node))).toBe(true);
  });
});
