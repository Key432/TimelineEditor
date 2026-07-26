import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `projects-e2e-${crypto.randomUUID()}@example.com`;
const password = `Projects-${crypto.randomUUID()}`;
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

test("creates, edits, and permanently deletes a project", async ({ page }) => {
  const authResponse = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(authResponse.status()).toBe(204);

  await page.goto("/projects");
  await page.getByRole("link", { name: "新規プロジェクト" }).first().click();
  await page.getByLabel("プロジェクト名").fill("日本文学史");
  await page.getByLabel("説明（任意）").fill("作家と作品の年表");
  await page.getByLabel("テンプレート").selectOption("literature");
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/timeline$/);
  const projectUrl = page.url();
  await page.goto(projectUrl.replace(/\/timeline$/, "/settings"));
  await expect(page.getByLabel("プロジェクト名")).toHaveValue("日本文学史");
  await expect(page.getByRole("link", { name: "一覧へ戻る" })).toBeVisible();

  await page.getByLabel("プロジェクト名").fill("日本近代文学史");
  const updateResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/projects/") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "設定を保存" }).click();
  expect((await updateResponse).status()).toBe(200);
  await expect(page.getByRole("button", { name: "設定を保存" })).toBeEnabled();
  await expect(page.getByLabel("プロジェクト名")).toHaveValue("日本近代文学史");
  await expect(page.getByRole("link", { name: "一覧へ戻る" })).toBeVisible();

  await page.getByRole("link", { name: "一覧へ戻る" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText("説明はまだありません。")).toHaveCount(0);
  const timelineCard = page.getByRole("link", {
    name: "日本近代文学史のタイムラインを開く",
  });
  await expect(timelineCard).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "ナビゲーションを開く" }).click();
  const navigationDialog = page.getByRole("dialog");
  await navigationDialog.getByRole("link", { name: "日本近代文学史" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/[0-9a-f-]+/timeline$`));
  await expect(navigationDialog).toBeHidden();

  await page.goto(projectUrl.replace(/\/timeline$/, "/item-types"));
  await expect(
    page.getByRole("link", { name: "プロジェクト設定へ" }),
  ).toBeVisible();
  await page.goto((await page.url()).replace(/\/item-types$/, "/settings"));

  await page.getByRole("button", { name: "プロジェクトを完全削除" }).click();
  const confirmDelete = page.getByRole("button", { name: "完全に削除" });
  await expect(confirmDelete).toBeDisabled();
  await page.getByLabel("プロジェクト名").last().fill("日本近代文学史");
  await expect(confirmDelete).toBeEnabled();
  await confirmDelete.click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText("日本近代文学史")).toHaveCount(0);
});
