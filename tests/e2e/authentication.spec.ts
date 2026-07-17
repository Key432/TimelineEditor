import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `e2e-${crypto.randomUUID()}@example.com`;
const password = `E2e-${crypto.randomUUID()}`;
let userId: string;

if (!url || !serviceRoleKey || !authSecret) {
  throw new Error("Local Supabase E2E environment is required.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
});

test("redirects unauthenticated users to the Google login", async ({
  page,
}) => {
  await page.goto("/projects");

  await expect(page).toHaveURL(/\/login\?next=%2Fprojects$/);
  await expect(
    page.getByRole("button", { name: "Googleでログイン" }),
  ).toBeVisible();
});

test("renders the authenticated layout and logs out", async ({ page }) => {
  const response = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(response.status()).toBe(204);

  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "プロジェクト" }),
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("serves noindex headers and blocks robots", async ({ page, request }) => {
  const response = await page.goto("/login");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
});
