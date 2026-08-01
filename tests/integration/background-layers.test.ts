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
const password = `L12-${crypto.randomUUID()}`;
const ownerEmail = `l12-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `l12-other-${crypto.randomUUID()}@example.com`;
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

describe("Phase L12 background layer RLS and constraints", () => {
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

  it("allows owner writes, hides private data, and exposes published backgrounds", async () => {
    const projectId = await createProject("年代背景RLS");
    const layer = await owner
      .from("timeline_background_layers")
      .insert({ project_id: projectId, name: "時代区分", sort_order: 0 })
      .select("id")
      .single();
    expect(layer.error).toBeNull();
    const period = await owner
      .from("timeline_background_periods")
      .insert({
        project_id: projectId,
        layer_id: layer.data!.id,
        title: "明治",
        color: "#7C9A92",
        start_era: "ce",
        start_precision: "year",
        start_year: 1868,
        start_calendar: "proleptic_gregorian",
        end_era: "ce",
        end_precision: "year",
        end_year: 1912,
        end_calendar: "proleptic_gregorian",
        is_start_approximate: true,
        is_end_approximate: false,
      })
      .select("id")
      .single();
    expect(period.error).toBeNull();

    const [otherRead, anonPrivate, otherWrite] = await Promise.all([
      other
        .from("timeline_background_layers")
        .select("id")
        .eq("project_id", projectId),
      anonymous
        .from("timeline_background_periods")
        .select("id")
        .eq("project_id", projectId),
      other
        .from("timeline_background_layers")
        .insert({ project_id: projectId, name: "侵入", sort_order: 1 }),
    ]);
    expect(otherRead.data).toEqual([]);
    expect(anonPrivate.data).toEqual([]);
    expect(otherWrite.error?.code).toBe("42501");

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
          .from("timeline_background_periods")
          .select("title")
          .eq("project_id", projectId)
      ).data,
    ).toEqual([{ title: "明治" }]);
  });

  it("rejects invalid ranges and cascades periods with their layer", async () => {
    const projectId = await createProject("年代背景制約");
    const layer = await owner
      .from("timeline_background_layers")
      .insert({ project_id: projectId, name: "政権", sort_order: 0 })
      .select("id")
      .single();
    const invalid = await owner.from("timeline_background_periods").insert({
      project_id: projectId,
      layer_id: layer.data!.id,
      title: "逆転",
      color: "#AA5500",
      start_era: "ce",
      start_precision: "year",
      start_year: 2000,
      start_calendar: "proleptic_gregorian",
      end_era: "ce",
      end_precision: "year",
      end_year: 1900,
      end_calendar: "proleptic_gregorian",
    });
    expect(invalid.error?.code).toBe("23514");
    await owner.from("timeline_background_periods").insert({
      project_id: projectId,
      layer_id: layer.data!.id,
      title: "有効",
      color: "#AA5500",
      start_era: "bce",
      start_precision: "century",
      start_year: 5,
      start_calendar: "proleptic_gregorian",
      end_era: "bce",
      end_precision: "century",
      end_year: 4,
      end_calendar: "proleptic_gregorian",
    });
    expect(
      (
        await owner
          .from("timeline_background_layers")
          .delete()
          .eq("id", layer.data!.id)
      ).error,
    ).toBeNull();
    expect(
      (
        await owner
          .from("timeline_background_periods")
          .select("id")
          .eq("layer_id", layer.data!.id)
      ).data,
    ).toEqual([]);
  });
});
