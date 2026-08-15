import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { waitUntilAccessTokenIsCurrent } from "./auth-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !publishableKey || !serviceRoleKey)
  throw new Error("Local Supabase environment is required.");
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const owner = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
const other = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
const anonymous = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
const password = `L18-${crypto.randomUUID()}`;
const ownerEmail = `l18-owner-${crypto.randomUUID()}@example.com`;
const otherEmail = `l18-other-${crypto.randomUUID()}@example.com`;
let ownerId = "";
let otherId = "";

describe("Phase L18 comparison saved view RLS", () => {
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
  });

  afterAll(async () => {
    await Promise.all([
      ownerId ? admin.auth.admin.deleteUser(ownerId) : Promise.resolve(),
      otherId ? admin.auth.admin.deleteUser(otherId) : Promise.resolve(),
    ]);
  });

  it("lets only the owner read and mutate settings-only views", async () => {
    const configuration = {
      version: 1,
      projectIds: [crypto.randomUUID()],
      hiddenProjectIds: [],
      visibleStartOrdinal: 1,
      visibleEndOrdinal: 2,
      zoomLevel: 1,
      highlightStartOrdinal: null,
      highlightEndOrdinal: null,
      filters: { tagNames: [], typeNames: [], eventTypeNames: [] },
    };
    const created = await owner
      .from("comparison_saved_views")
      .insert({ name: "比較", configuration })
      .select("id, owner_id, configuration")
      .single();
    expect(created.error).toBeNull();
    expect(created.data?.owner_id).toBe(ownerId);
    expect(created.data?.configuration).not.toHaveProperty("items");

    const [otherRead, anonymousRead, otherUpdate] = await Promise.all([
      other
        .from("comparison_saved_views")
        .select("id")
        .eq("id", created.data!.id),
      anonymous
        .from("comparison_saved_views")
        .select("id")
        .eq("id", created.data!.id),
      other
        .from("comparison_saved_views")
        .update({ name: "侵入" })
        .eq("id", created.data!.id)
        .select("id"),
    ]);
    expect(otherRead.data).toEqual([]);
    expect(anonymousRead.error).not.toBeNull();
    expect(otherUpdate.data).toEqual([]);
    expect(
      (
        await owner
          .from("comparison_saved_views")
          .delete()
          .eq("id", created.data!.id)
      ).error,
    ).toBeNull();
  });

  it("prevents assigning a saved view to another user", async () => {
    const inserted = await owner.from("comparison_saved_views").insert({
      owner_id: otherId,
      name: "不正所有者",
      configuration: { version: 1 },
    });
    expect(inserted.error?.code).toBe("42501");
  });
});
