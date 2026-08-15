import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const email = `comparison-${crypto.randomUUID()}@example.com`;
const password = `Compare-${crypto.randomUUID()}`;
let userId = "";

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

async function createProject(
  page: import("@playwright/test").Page,
  index: number,
) {
  const response = await page.request.post("/api/projects", {
    data: {
      name: `比較プロジェクト${index}`,
      description: `比較用データ${index}`,
      template: "general",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1700,
        initialEndYear: 2000,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
    },
  });
  expect(response.ok()).toBe(true);
  const projectId = ((await response.json()) as { project: { id: string } })
    .project.id;
  const types = (await (
    await page.request.get(`/api/projects/${projectId}/item-types`)
  ).json()) as { itemTypes: { id: string }[] };
  expect(
    (
      await page.request.post(`/api/projects/${projectId}/items`, {
        data: {
          typeId: types.itemTypes[0]!.id,
          title: `出来事${index}`,
          aliases: [],
          tagIds: [],
          customFields: [],
          description: null,
          sourceText: "",
          citations: [],
          externalUrl: "",
          temporalType: "point",
          colorOverride: null,
          isVisible: true,
          start: null,
          isStartApproximate: false,
          endDateStatus: null,
          end: null,
          isEndApproximate: false,
          lastConfirmed: null,
          point: { year: 1750 + index * 20, month: null, day: null },
          isPointApproximate: false,
        },
      })
    ).ok(),
  ).toBe(true);
  return projectId;
}

test("compares more than three projects inside timeline with synchronized interaction", async ({
  browserName,
  page,
}) => {
  expect(
    (
      await page.request.post("/api/test-auth", {
        data: { email, password },
        headers: { "x-test-auth-secret": authSecret },
      })
    ).status(),
  ).toBe(204);
  const projectIds: string[] = [];
  for (let index = 1; index <= 6; index += 1)
    projectIds.push(await createProject(page, index));

  await page.goto(`/projects/${projectIds[0]}/timeline`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "他プロジェクトと比較" }).click();
  const dialog = page.getByRole("dialog", { name: "他プロジェクトと比較" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "他プロジェクトと比較" }).click();
  const search = dialog.getByLabel("比較するプロジェクトを検索");
  await search.fill("比較プロジェクト2");
  await expect(
    dialog.getByText("比較プロジェクト2", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("比較プロジェクト3", { exact: true }),
  ).toHaveCount(0);
  await search.clear();
  for (const name of [2, 3, 4, 5].map((index) => `比較プロジェクト${index}`))
    await dialog.getByText(name, { exact: true }).click();
  await dialog.getByRole("button", { name: "4件を比較" }).click();

  const stack = page.getByTestId("timeline-comparison-stack");
  await expect(stack.getByRole("region")).toHaveCount(5);
  await expect(page.getByText("コンパクト表示（比較中）")).toHaveCount(1);
  await expect(page.getByTestId("timeline-axis-header")).toHaveCount(1);
  await expect(
    page.getByText(/上下左右へドラッグ、スクロールバー/),
  ).toHaveCount(0);
  await expect(page.getByLabel(/比較画面\d+のプロジェクト/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /アイテムを追加/ }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      stack.evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true);

  const viewports = page.getByTestId("timeline-viewport");
  await expect(viewports).toHaveCount(5);
  const regions = stack.getByRole("region");
  await regions
    .nth(0)
    .getByRole("button", { name: "タイムライン操作を開く" })
    .click();
  await regions
    .nth(1)
    .getByRole("button", { name: "タイムライン操作を開く" })
    .click();
  const firstZoom = regions.nth(0).getByLabel("ズーム段階");
  const secondZoom = regions.nth(1).getByLabel("ズーム段階");
  const initialZoom = Number(await firstZoom.inputValue());
  await regions.nth(0).getByRole("button", { name: "拡大" }).click();
  await expect(firstZoom).toHaveValue(String(initialZoom + 1));
  await expect(secondZoom).toHaveValue(String(initialZoom + 1));
  await viewports.first().evaluate((element) => {
    element.scrollLeft = 180;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect
    .poll(() => viewports.nth(1).evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(150);

  await viewports.first().hover({ position: { x: 240, y: 80 } });
  await expect(page.getByTestId("timeline-pointer-guide")).toHaveCount(5);

  await page.getByRole("button", { name: "他プロジェクトと比較" }).click();
  const firstHandle = dialog.getByRole("button", {
    name: "比較プロジェクト2を並べ替え",
  });
  const secondHandle = dialog.getByRole("button", {
    name: "比較プロジェクト3を並べ替え",
  });
  if (browserName === "firefox") {
    await firstHandle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
  } else {
    await firstHandle.dragTo(secondHandle);
  }
  await dialog.getByRole("button", { name: "4件を比較" }).click();
  await expect(stack.getByRole("region").nth(1)).toHaveAttribute(
    "aria-label",
    "比較プロジェクト3のタイムライン",
  );
  await expect(stack.getByRole("region").nth(2)).toHaveAttribute(
    "aria-label",
    "比較プロジェクト2のタイムライン",
  );
});
