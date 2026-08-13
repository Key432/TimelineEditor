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
const email = `l12-e2e-${crypto.randomUUID()}@example.com`;
const password = `L12-${crypto.randomUUID()}`;
let userId = "";

test.beforeAll(async () => {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;
});
test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("manages, draws, saves, and publicly shows historical background layers", async ({
  page,
}) => {
  const auth = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  await page.goto("/projects/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("プロジェクト名").fill("年代背景テスト");
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/timeline$/);
  const projectId = page.url().match(/\/projects\/([^/]+)\/timeline/)?.[1];
  if (!projectId) throw new Error("Project ID is required.");

  await page.getByRole("button", { name: "最初のタイムラインを作成" }).click();
  const itemForm = page.getByRole("form", { name: "タイムラインアイテム作成" });
  await itemForm.getByLabel("名称").fill("近代");
  const years = itemForm.getByLabel("年");
  await years.nth(0).fill("1800");
  await years.nth(1).fill("2000");
  await itemForm
    .getByRole("button", { name: "タイムラインアイテムを作成" })
    .click();
  await expect(page.getByText("近代", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page.getByRole("menuitem", { name: "年代背景" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("新しいレイヤー名").fill("時代区分");
  await dialog.getByRole("button", { name: "レイヤーを追加" }).click();
  await expect(dialog.getByLabel("時代区分のレイヤー名")).toBeVisible();
  await dialog.getByRole("button", { name: "背景期間を追加" }).click();
  const periodForm = dialog.getByRole("form", { name: "背景期間を追加" });
  await periodForm.getByLabel("期間名").fill("明治時代");
  const periodYears = periodForm.getByLabel("年");
  await periodYears.nth(0).fill("1868");
  await periodYears.nth(1).fill("1912");
  await periodForm.getByText("おおよそ").first().click();
  await periodForm.getByRole("button", { name: "期間を追加" }).click();
  await expect(dialog.getByText("明治時代", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "閉じる" }).click();

  await expect(page.getByTestId("timeline-background-layers")).toBeVisible();
  await expect(page.getByText("時代区分 · 明治時代")).toBeVisible();
  await page.getByRole("button", { name: "移動・ビュー", exact: true }).click();
  await page.getByLabel("保存済みビュー名").fill("明治背景");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await page
    .getByTestId("timeline-workspace")
    .getByRole("button", { name: "表示", exact: true })
    .click();
  await page.getByRole("menuitemcheckbox", { name: "時代区分" }).click();
  await expect(page.getByTestId("timeline-background-layers")).toHaveCount(0);
  await page.getByRole("button", { name: "移動・ビュー", exact: true }).click();
  await page.getByRole("menuitem", { name: "明治背景" }).click();
  await expect(page.getByTestId("timeline-background-layers")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("timeline-background-layers")).toBeVisible();
  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page.getByRole("menuitem", { name: "年代背景" }).click();
  await expect(page.getByRole("dialog").getByText("明治時代")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  await page.setViewportSize({ width: 1280, height: 720 });

  const published = await page.request.post(
    `/api/projects/${projectId}/publish`,
  );
  expect(published.ok()).toBe(true);
  const publicId = (
    (await published.json()) as { project: { publicId: string } }
  ).project.publicId;
  await page.goto(`/public/${publicId}`);
  await expect(page.getByText("時代区分 · 明治時代")).toBeVisible();
  await page.getByRole("button", { name: "コンパクト" }).click();
  await expect(page.getByTestId("timeline-background-layers")).toBeVisible();
});
