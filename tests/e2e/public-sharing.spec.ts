import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const email = `public-e2e-${crypto.randomUUID()}@example.com`;
const password = `Public-${crypto.randomUUID()}`;
let userId = "";

test.beforeAll(async () => {
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error) throw result.error;
  userId = result.data.user.id;
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("publishes for anonymous viewing and unpublishes immediately", async ({
  page,
  browser,
}) => {
  const auth = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  await page.goto("/projects/new");
  await page.getByLabel("プロジェクト名").fill("公開テスト年表");
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "公開する" }).click();
  await page.getByRole("button", { name: "公開する" }).last().click();
  const publicUrl = await page.getByLabel("共有URL").inputValue();

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  const response = await anonymousPage.goto(publicUrl);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(
    anonymousPage.getByRole("heading", { name: "公開テスト年表" }),
  ).toBeVisible();
  await expect(anonymousPage.getByText("公開・閲覧専用")).toBeVisible();
  await expect(
    anonymousPage.getByRole("button", { name: /アイテムを追加/ }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "非公開にする" }).click();
  await page.getByRole("button", { name: "非公開にする" }).last().click();
  await expect(page.getByRole("button", { name: "公開する" })).toBeVisible();
  const hiddenResponse = await anonymousPage.reload();
  expect(hiddenResponse?.status()).toBe(404);
  await anonymousContext.close();
});
