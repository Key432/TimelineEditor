import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `item-types-e2e-${crypto.randomUUID()}@example.com`;
const password = `ItemTypes-${crypto.randomUUID()}`;
let userId = "";

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
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("adds, edits, hides, and reorders an item type", async ({ page }) => {
  const authResponse = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(authResponse.status()).toBe(204);

  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "建築史",
      description: null,
      template: "general",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1800,
        initialEndYear: 2026,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
    },
  });
  expect(projectResponse.status()).toBe(201);
  const {
    project: { id: projectId },
  } = (await projectResponse.json()) as { project: { id: string } };
  await page.goto(`/projects/${projectId}/item-types`);

  await expect(
    page.getByText("対象種別", { exact: true }).last(),
  ).toBeVisible();
  const combobox = page.getByRole("combobox", {
    name: "対象種別を検索・新規作成",
  });
  await combobox.fill("建築");
  await combobox.press("Enter");
  await expect(page.getByLabel("名称").last()).toHaveValue("建築");

  await page.getByLabel("名称").last().fill("建築史料");
  await page.getByLabel("建築の色コード").fill("#123456");
  await page.getByRole("button", { name: "建築の変更を保存" }).click();
  await expect(page.getByLabel("名称").last()).toHaveValue("建築史料");
  await expect(page.getByLabel("建築史料の色コード")).toHaveValue("#123456");

  await page.getByRole("button", { name: "建築史料を非表示" }).click();
  await expect(
    page.getByRole("button", { name: "建築史料を表示" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "建築史料を上へ移動" }).click();
  const rows = page.locator("#item-type-list > li");
  await expect(rows.nth(9).getByLabel("名称")).toHaveValue("建築史料");
});
