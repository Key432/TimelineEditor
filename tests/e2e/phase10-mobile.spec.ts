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
const email = `mobile-e2e-${crypto.randomUUID()}@example.com`;
const password = `Mobile-${crypto.randomUUID()}`;
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

test("keeps mobile editing available while touch gestures never create an event from the field", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const auth = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  await page.goto("/projects/new");
  // Firefox can receive the server-rendered form before React hydration. Wait
  // before typing so hydration cannot restore the empty initial form value.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("プロジェクト名").fill("モバイル最終確認");
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/timeline$/);
  const projectId = page.url().match(/\/projects\/([^/]+)\/timeline/)?.[1];
  if (!projectId) throw new Error("Project ID is required.");

  await page.getByRole("button", { name: "アイテムを追加" }).click();
  await page.getByRole("menuitem", { name: "タイムラインを追加" }).click();
  const form = page.getByRole("form", { name: "タイムラインアイテム作成" });
  await form.getByLabel("名称").fill("モバイル編集対象");
  const years = form.getByLabel("年");
  await years.nth(0).fill("1900");
  await years.nth(1).fill("2000");
  await form
    .getByRole("button", { name: "タイムラインアイテムを作成" })
    .click();
  await expect(
    page.getByText("モバイル編集対象", { exact: true }),
  ).toBeVisible();

  const viewport = page.getByTestId("timeline-viewport");
  const fixedColumns = viewport
    .getByTestId(/^timeline-row-/)
    .first()
    .locator("[data-timeline-fixed-column]");
  const [infoBox, actionsBox, viewportBox] = await Promise.all([
    fixedColumns
      .filter({ has: page.getByText("モバイル編集対象") })
      .boundingBox(),
    fixedColumns.last().boundingBox(),
    viewport.boundingBox(),
  ]);
  if (!infoBox || !actionsBox || !viewportBox)
    throw new Error("Mobile timeline columns are required.");
  expect(infoBox.width).toBeLessThanOrEqual(132);
  expect(actionsBox.width).toBeLessThanOrEqual(44);
  expect(actionsBox.x - (infoBox.x + infoBox.width)).toBeGreaterThanOrEqual(
    120,
  );
  await page.getByRole("button", { name: "モバイル編集対象の操作" }).click();
  await expect(page.getByRole("menuitem", { name: "上へ移動" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "編集" })).toBeVisible();
  await page.keyboard.press("Escape");

  const zoom = page.getByLabel("ズーム段階");
  await zoom.fill("1");
  const eventSurface = page.locator("[data-timeline-event-parent-id]").first();
  const box = await eventSurface.boundingBox();
  if (!box) throw new Error("Timeline event surface is required.");
  await eventSurface.dispatchEvent("pointerdown", {
    pointerId: 11,
    pointerType: "touch",
    button: 0,
    clientX: box.x + 80,
    clientY: box.y + 10,
  });
  await eventSurface.dispatchEvent("pointerdown", {
    pointerId: 12,
    pointerType: "touch",
    button: 0,
    clientX: box.x + 140,
    clientY: box.y + 10,
  });
  await eventSurface.dispatchEvent("pointermove", {
    pointerId: 12,
    pointerType: "touch",
    button: 0,
    clientX: box.x + 220,
    clientY: box.y + 10,
  });
  await eventSurface.dispatchEvent("pointerup", {
    pointerId: 12,
    pointerType: "touch",
    button: 0,
    clientX: box.x + 220,
    clientY: box.y + 10,
  });
  await eventSurface.dispatchEvent("pointerup", {
    pointerId: 11,
    pointerType: "touch",
    button: 0,
    clientX: box.x + 80,
    clientY: box.y + 10,
  });
  await expect(zoom).toHaveValue("2");

  for (const pointerId of [21, 22]) {
    await eventSurface.dispatchEvent("pointerdown", {
      pointerId,
      pointerType: "touch",
      button: 0,
      clientX: box.x + 120,
      clientY: box.y + 10,
    });
    await eventSurface.dispatchEvent("pointerup", {
      pointerId,
      pointerType: "touch",
      button: 0,
      clientX: box.x + 120,
      clientY: box.y + 10,
    });
  }
  await expect(
    page.getByRole("heading", { name: "イベントアイテムを追加" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page
    .getByRole("menuitem", { name: "インポート／エクスポート" })
    .click();
  await expect(
    page.getByRole("heading", { name: "インポート／エクスポート" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(`/projects/${projectId}/settings`);
  await expect(
    page.getByRole("link", { name: "インポート／エクスポート" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "インポート／エクスポート" }).click();
  await expect(page.getByLabel("JSONバックアップ")).toBeVisible();
  await expect(page.getByLabel("CSVまたはCSV ZIP")).toBeVisible();
  await expect(page.getByRole("link", { name: /JSONを保存/ })).toBeVisible();

  const [jsonExport, csvExport] = await Promise.all([
    page.request.get(`/api/projects/${projectId}/export/json`),
    page.request.get(`/api/projects/${projectId}/export/csv`),
  ]);
  expect(jsonExport.ok()).toBe(true);
  expect(csvExport.ok()).toBe(true);
  expect(jsonExport.headers()["content-disposition"]).toContain(
    encodeURIComponent("モバイル最終確認_"),
  );
  expect(csvExport.headers()["content-type"]).toContain("application/zip");
  await page.getByLabel("CSVまたはCSV ZIP").setInputFiles({
    name: "project.zip",
    mimeType: "application/zip",
    buffer: await csvExport.body(),
  });
  await expect(
    page.getByText(/タイムライン種別 .*タイムライン 1件/),
  ).toBeVisible();
  await page.getByRole("button", { name: "全体を中止" }).click();

  await page.getByLabel("JSONバックアップ").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(
            JSON.parse((await jsonExport.body()).toString()),
          ).filter(([key]) => key !== "schemaVersion"),
        ),
      ),
    ),
  });
  await expect(
    page.getByText("旧JSON形式をスキーマバージョン7へ移行しました。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "現在のプロジェクトを上書き" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "現在のプロジェクトを上書き" })
    .click();
  await expect(page).toHaveURL(`/projects/${projectId}/timeline`);
  await expect(
    page.getByText("モバイル編集対象", { exact: true }),
  ).toBeVisible();

  await page.goto("/projects/new");
  await expect(page.getByLabel("JSONから新規作成")).toBeVisible();
  await expect(page.getByLabel("CSV ZIPから新規作成")).toBeVisible();
  await page.getByLabel("JSONから新規作成").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: await jsonExport.body(),
  });
  await page.getByRole("button", { name: "このデータで作成" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/timeline$/);
  expect(page.url()).not.toContain(projectId);
});
