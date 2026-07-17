import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = `integration-${crypto.randomUUID()}@example.com`;
const password = `Integration-${crypto.randomUUID()}`;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Local Supabase environment is required.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const browser = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let userId: string | undefined;

describe("local Supabase authentication", () => {
  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("signs in a local test user and validates the identity", async () => {
    const { data, error } = await browser.auth.signInWithPassword({
      email,
      password,
    });

    expect(error).toBeNull();
    expect(data.user?.email).toBe(email);

    const { data: userData, error: userError } = await browser.auth.getUser();
    expect(userError).toBeNull();
    expect(userData.user?.id).toBe(userId);
  });

  it("rejects invalid credentials", async () => {
    const { error } = await browser.auth.signInWithPassword({
      email,
      password: "invalid-password",
    });

    expect(error).not.toBeNull();
  });
});
