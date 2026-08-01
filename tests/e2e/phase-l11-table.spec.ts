import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { postAfterConnectionReset } from "./helpers/request";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const email = `phase-l11-${crypto.randomUUID()}@example.com`;
const password = `PhaseL11-${crypto.randomUUID()}`;
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

test("edits and adds rows in the Notion-style table view", async ({ page }) => {
  test.slow();
  const auth = await postAfterConnectionReset(page.request, "/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "L11 table project",
      description: null,
      template: "general",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1900,
        initialEndYear: 2026,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
    },
  });
  expect(projectResponse.status()).toBe(201);
  const projectId = (
    (await projectResponse.json()) as { project: { id: string } }
  ).project.id;
  const typesResponse = await page.request.get(
    `/api/projects/${projectId}/item-types`,
  );
  const typePayload = (await typesResponse.json()) as {
    itemTypes: { id: string; name: string }[];
  };
  const typeId = typePayload.itemTypes[0]!.id;
  const typeName = typePayload.itemTypes[0]!.name;
  const itemResponse = await page.request.post(
    `/api/projects/${projectId}/items`,
    {
      data: {
        typeId,
        title: "Existing row",
        aliases: [],
        tagIds: [],
        customFields: [],
        addPreviousTitleToAliases: false,
        description: "long body is not rendered in the table",
        sourceText: "long source is not rendered in the table",
        citations: [],
        externalUrl: "https://example.com/resource",
        temporalType: "point",
        colorOverride: null,
        isVisible: true,
        start: null,
        isStartApproximate: false,
        endDateStatus: null,
        end: null,
        isEndApproximate: false,
        lastConfirmed: null,
        point: {
          era: "ce",
          precision: "year",
          year: 2000,
          month: null,
          day: null,
          originalText: null,
          calendar: "proleptic_gregorian",
        },
        isPointApproximate: false,
      },
    },
  );
  expect(itemResponse.status()).toBe(201);

  await page.goto(`/projects/${projectId}/timeline`);
  await page.getByRole("button", { name: "テーブル" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/timeline\\?layout=table$`),
  );
  await expect(page.getByRole("tab", { name: "タイムライン表" })).toBeVisible();
  await expect
    .poll(async () =>
      page
        .locator('[role="columnheader"] > span')
        .evaluateAll((labels) =>
          labels.slice(0, 4).map((label) => label.textContent),
        ),
    )
    .toEqual(["名称", "形式", "開始・時点日", "終了日"]);
  await expect(
    page.getByRole("columnheader", { name: /開始・時点日/ }),
  ).toBeVisible();
  await expect(page.getByRole("cell").getByText("時点")).toBeVisible();
  await expect(
    page.getByRole("cell").getByText("未選択").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("cell").getByText(typeName, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "列を追加" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "列の表示と順番" }),
  ).toBeVisible();
  await expect(
    page.getByText("long body is not rendered in the table"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "外部URLを開く" }),
  ).toHaveAttribute("href", "https://example.com/resource");

  const longTitle =
    "This is a deliberately long timeline item name that must wrap across multiple lines when wrapping is enabled";
  const titleCell = page.getByRole("cell").filter({ hasText: "Existing row" });
  await titleCell.getByRole("button", { name: "Existing row" }).click();
  const titleInput = page.locator('input[type="text"][value="Existing row"]');
  await titleInput.fill(longTitle);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "名称の設定" }).click();
  await page
    .getByRole("menuitemcheckbox", { name: "折り返して表示する" })
    .click();
  const wrappedTitleCell = page
    .getByRole("cell")
    .filter({ hasText: longTitle });
  await expect(
    wrappedTitleCell.getByRole("button", { name: longTitle }),
  ).not.toHaveClass(/truncate/);
  await expect
    .poll(async () => (await wrappedTitleCell.boundingBox())?.height ?? 0)
    .toBeGreaterThan(40);

  await page.getByRole("button", { name: "列", exact: true }).click();
  await page.getByRole("button", { name: "開始・時点日を左へ移動" }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(async () =>
      page
        .locator('[role="columnheader"] > span')
        .evaluateAll((labels) =>
          labels.slice(0, 4).map((label) => label.textContent),
        ),
    )
    .toEqual(["名称", "開始・時点日", "形式", "終了日"]);

  await page.getByRole("button", { name: "新しい行" }).click();
  await page.getByLabel("新しい項目の名称").fill("Draft row");
  await page.getByLabel("新しい項目の開始・時点日").fill("2001");
  await page.getByLabel("新しい項目の終了状態").selectOption("ongoing");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByText("Draft row", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "イベント表" }).click();
  await expect(
    page.getByRole("columnheader", { name: /親タイムライン/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "列を追加" }).click();
  await page.getByLabel("名前").fill("場所");
  await page.getByRole("button", { name: "プロパティを追加" }).click();
  await expect(page.getByRole("columnheader", { name: /場所/ })).toBeVisible();
});
