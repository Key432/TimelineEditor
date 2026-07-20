import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `timeline-items-e2e-${crypto.randomUUID()}@example.com`;
const password = `TimelineItems-${crypto.randomUUID()}`;
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

test("creates, draws, edits, groups, reorders, and deletes timeline items", async ({
  page,
}) => {
  const authResponse = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(authResponse.status()).toBe(204);

  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "近代文学史",
      description: null,
      template: "literature",
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

  await page.goto(`/projects/${projectId}/timeline`);
  await page.getByRole("button", { name: "最初の項目を作成" }).click();
  const rangeForm = page.getByRole("form", { name: "タイムライン項目作成" });
  await rangeForm.getByLabel("名称").fill("夏目漱石");
  const rangeYears = rangeForm.getByLabel("年");
  await rangeYears.nth(0).fill("1867");
  await rangeYears.nth(1).fill("1916");
  await rangeForm.getByLabel("開始日はおおよそ").check();
  await rangeForm.getByRole("button", { name: "項目を作成" }).click();

  await expect(page.getByText("夏目漱石", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/期間型バー/)).toBeVisible();

  await page.getByRole("button", { name: "項目を追加" }).click();
  const pointForm = page.getByRole("form", { name: "タイムライン項目作成" });
  await pointForm.getByLabel("名称").fill("『吾輩は猫である』刊行");
  await pointForm.getByLabel("時点").check();
  await pointForm.getByLabel("年").fill("1905");
  await pointForm.getByRole("button", { name: "項目を作成" }).click();

  await expect(
    page.getByText("『吾輩は猫である』刊行", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/時点型マーカー/)).toBeVisible();

  const moveUp = page.getByRole("button", {
    name: "『吾輩は猫である』刊行を上へ移動",
  });
  await moveUp.focus();
  await page.keyboard.press("Enter");
  const rows = page.locator("[data-testid^='timeline-row-']");
  await expect(rows.first()).toContainText("『吾輩は猫である』刊行");

  await page.getByLabel("対象種別でグループ化").click();
  const personGroup = page.getByRole("button", { name: /人物/ });
  await expect(personGroup).toBeVisible();
  await personGroup.click();
  await expect(page.getByText("夏目漱石", { exact: true })).toBeHidden();
  await personGroup.click();

  await page.getByRole("button", { name: "夏目漱石を編集" }).click();
  const editForm = page.getByRole("form", { name: "タイムライン項目編集" });
  await editForm.getByLabel("概要（任意）").fill("小説家・英文学者");
  await editForm.getByRole("button", { name: "変更を保存" }).click();
  await expect(editForm).toBeHidden();

  await page.getByRole("button", { name: "夏目漱石を編集" }).click();
  await page.getByRole("button", { name: "完全削除" }).click();
  await page.getByRole("button", { name: "完全削除" }).last().click();
  await expect(page.getByText("夏目漱石", { exact: true })).toBeHidden();
});
