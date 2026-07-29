import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { navigateWithDocumentLoad } from "./helpers/navigation";

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
  test.slow();
  const auth = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  await page.goto("/projects/new");
  await page.getByLabel("プロジェクト名").fill("公開テスト年表");
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/timeline$/);
  const projectId = page.url().match(/\/projects\/([^/]+)\/timeline/)?.[1];
  if (!projectId) throw new Error("Project ID is required.");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const { data: itemType, error: itemTypeError } = await admin
    .from("timeline_item_types")
    .select("id")
    .eq("project_id", projectId)
    .order("sort_order")
    .limit(1)
    .single();
  if (itemTypeError) throw itemTypeError;
  const longDescription = Array.from(
    { length: 120 },
    (_, index) => `長い本文 ${index + 1}`,
  ).join("\n");
  const { data: item, error: itemError } = await admin
    .from("timeline_items")
    .insert({
      project_id: projectId,
      type_id: itemType.id,
      title: "公開詳細のスクロール確認",
      description: longDescription,
      temporal_type: "range",
      manual_order: 0,
      start_year: 1900,
      end_date_status: "specified",
      end_year: 1950,
    })
    .select("id")
    .single();
  if (itemError) throw itemError;
  const { data: event, error: eventError } = await admin
    .from("timeline_events")
    .insert({
      project_id: projectId,
      timeline_item_id: item.id,
      title: "公開イベント詳細のスクロール確認",
      event_year: 1920,
      description: longDescription,
    })
    .select("id")
    .single();
  if (eventError) throw eventError;

  await page.getByRole("button", { name: "公開する" }).click();
  const publishDialog = page.getByRole("alertdialog");
  await expect(publishDialog).toBeVisible();
  const publishResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/publish`) &&
      response.request().method() === "POST",
  );
  await publishDialog.getByRole("button", { name: "公開する" }).click();
  expect((await publishResponsePromise).status()).toBe(200);
  const publicUrl = await page.getByLabel("共有URL").inputValue();

  await page.goto("/projects");
  const projectCard = page.locator(
    `[data-slot="card"]:has(a[href="/projects/${projectId}/timeline"])`,
  );
  await expect(
    projectCard.getByText("公開テスト年表", { exact: true }),
  ).toBeVisible();
  await expect(projectCard.getByText("公開済", { exact: true })).toBeVisible();

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

  const publicDetailUrls = [
    `${publicUrl}/items/${item.id}`,
    `${publicUrl}/events/${event.id}`,
  ];
  for (const [index, detailUrl] of publicDetailUrls.entries()) {
    const detailResponse = await anonymousPage.request.get(detailUrl);
    expect(detailResponse.status()).toBe(200);
    await anonymousPage.goto(detailUrl);
    await anonymousPage.getByRole("button", { name: "詳細オプション" }).click();
    const mincho = anonymousPage.getByRole("menuitemradio", { name: "明朝" });
    if (index === 0) {
      await mincho.focus();
      await anonymousPage.keyboard.press("Enter");
    } else {
      await expect(mincho).toHaveAttribute("aria-checked", "false");
      await expect(
        anonymousPage.getByRole("menuitemradio", { name: "ゴシック" }),
      ).toHaveAttribute("aria-checked", "true");
      await anonymousPage.keyboard.press("Escape");
    }
    await expect(
      anonymousPage.locator(
        index === 0
          ? "[data-detail-font='mincho']"
          : "[data-detail-font='gothic']",
      ),
    ).toBeVisible();
    const main = anonymousPage.locator("main");
    await expect(main).toHaveCSS("overflow-y", "auto");
    const scrollMetrics = await main.evaluate((element) => {
      element.style.height = "200px";
      element.scrollTop = element.scrollHeight;
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      };
    });
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(
      scrollMetrics.clientHeight,
    );
    expect(scrollMetrics.scrollTop).toBeGreaterThan(0);
  }

  await navigateWithDocumentLoad(page, `/projects/${projectId}/settings`);
  await page.getByRole("button", { name: "非公開にする" }).click();
  const unpublishDialog = page.getByRole("alertdialog");
  await expect(unpublishDialog).toBeVisible();
  const unpublishResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/unpublish`) &&
      response.request().method() === "POST",
  );
  await unpublishDialog.getByRole("button", { name: "非公開にする" }).click();
  expect((await unpublishResponsePromise).status()).toBe(200);
  await expect(page.getByRole("button", { name: "公開する" })).toBeVisible();
  const hiddenResponse = await anonymousPage.reload();
  expect(hiddenResponse?.status()).toBe(404);
  await anonymousContext.close();
});
