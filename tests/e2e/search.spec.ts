import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `search-e2e-${crypto.randomUUID()}@example.com`;
const password = `SearchE2E-${crypto.randomUUID()}`;
let userId = "";
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");
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

test("searches globally, filters by event content, restores URL state, and returns", async ({
  page,
}) => {
  test.setTimeout(90_000);
  expect(
    (
      await page.request.post("/api/test-auth", {
        data: { email, password },
        headers: { "x-test-auth-secret": authSecret },
      })
    ).status(),
  ).toBe(204);
  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "検索E2E文学史",
      description: "日本語全文検索の検証",
      template: "general",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1850,
        initialEndYear: 1950,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
    },
  });
  const { project } = (await projectResponse.json()) as {
    project: { id: string };
  };
  const typeResponse = await page.request.get(
    `/api/projects/${project.id}/item-types`,
  );
  const { itemTypes } = (await typeResponse.json()) as {
    itemTypes: { id: string }[];
  };

  async function createItem(title: string, order: number) {
    const response = await page.request.post(
      `/api/projects/${project.id}/items`,
      {
        data: {
          typeId: itemTypes[0]!.id,
          title,
          description: title === "夏目漱石" ? "明治期の作家" : "比較対象",
          sourceText: "文学史資料",
          externalUrl: "",
          temporalType: "range",
          colorOverride: order === 0 ? "#FF3399" : null,
          isVisible: true,
          start: { year: 1867 + order * 20, month: null, day: null },
          isStartApproximate: order === 0,
          endDateStatus: "specified",
          end: { year: 1916 + order * 20, month: null, day: null },
          isEndApproximate: false,
          lastConfirmed: null,
          point: null,
          isPointApproximate: false,
        },
      },
    );
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { item: { id: string } }).item;
  }

  const matchingItem = await createItem("夏目漱石", 0);
  const otherItem = await createItem("比較対象の作家", 1);
  const eventResponse = await page.request.post(
    `/api/projects/${project.id}/events`,
    {
      data: {
        timelineItemId: matchingItem.id,
        title: "代表作刊行",
        date: { year: 1905, month: 1, day: 1 },
        isApproximate: false,
        description: "隠れた猫作品キーワード",
        sourceText: "初出版資料",
        externalUrl: "",
      },
    },
  );
  expect(eventResponse.ok()).toBe(true);

  await page.goto(`/projects/${project.id}/timeline`);
  const globalSearch = page.getByRole("combobox", { name: "全体検索" });
  await globalSearch.fill("隠れた猫作品キーワード");
  await expect(page.getByRole("option", { name: /代表作刊行/ })).toBeVisible();
  await globalSearch.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(
    page.getByRole("heading", { name: "イベントアイテム" }),
  ).toBeVisible();
  const result = page.getByRole("link", { name: /代表作刊行/ });
  await result.click();
  await expect(page.getByRole("heading", { name: "代表作刊行" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(result).toBeVisible();

  await page.goto(`/projects/${project.id}/timeline`);
  await page.getByRole("button", { name: /フィルター/ }).click();
  await page.getByLabel("タイムライン内検索").fill("隠れた猫作品キーワード");
  await expect(page).toHaveURL(/q=%E9%9A%A0%E3%82%8C%E3%81%9F/);
  await expect(
    page.getByTestId(`timeline-row-${matchingItem.id}`),
  ).toBeVisible();
  await expect(page.getByTestId(`timeline-row-${otherItem.id}`)).toHaveCount(0);
  await expect(page.locator("[data-search-match='true']")).toHaveCount(1);

  await page.getByRole("button", { name: "薄く表示" }).click();
  const dimmed = page.getByTestId(`timeline-row-${otherItem.id}`);
  await expect(dimmed).toBeVisible();
  await expect(dimmed).toHaveCSS("opacity", "0.3");
  await expect(page).toHaveURL(/filterMode=dim/);

  await page.reload();
  await expect(
    page.getByTestId(`timeline-row-${matchingItem.id}`),
  ).toBeVisible();
  await expect(page.getByTestId(`timeline-row-${otherItem.id}`)).toHaveCSS(
    "opacity",
    "0.3",
  );
});
