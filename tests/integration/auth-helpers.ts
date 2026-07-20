import { setTimeout as delay } from "node:timers/promises";

export async function waitUntilAccessTokenIsCurrent(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Local Supabase environment is required.");
  }

  // Auth and PostgREST run in separate local containers. Poll the actual
  // authorization boundary instead of assuming a fixed clock-skew duration.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${url}/rest/v1/projects?select=id&limit=0`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (response.ok) return;

    const message = await response.text();
    if (response.status !== 401 || !message.includes("JWT issued at future")) {
      throw new Error(`PostgREST rejected the access token: ${message}`);
    }
    await delay(100);
  }

  throw new Error(
    "PostgREST did not accept the access token within 10 seconds.",
  );
}
