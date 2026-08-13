import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { navigateWithDocumentLoad } from "./helpers/navigation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const authSecret = process.env.E2E_TEST_AUTH_SECRET!;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const email = `relationships-e2e-${crypto.randomUUID()}@example.com`;
const password = `Relationships-${crypto.randomUUID()}`;
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

async function createItem(
  page: Page,
  projectId: string,
  typeId: string,
  title: string,
  startYear: number,
) {
  const response = await page.request.post(`/api/projects/${projectId}/items`, {
    data: {
      typeId,
      title,
      aliases: [],
      tagIds: [],
      customFields: [],
      description: "",
      sourceText: "",
      citations: [],
      externalUrl: "",
      temporalType: "range",
      colorOverride: null,
      isVisible: true,
      start: { year: startYear, month: null, day: null },
      isStartApproximate: false,
      endDateStatus: "specified",
      end: { year: startYear + 30, month: null, day: null },
      isEndApproximate: false,
      lastConfirmed: null,
      point: null,
      isPointApproximate: false,
    },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { item: { id: string } }).item.id;
}

test("creates, edits, renders across collapsible groups, and deletes a semantic relationship", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("Hydration failed")
    ) {
      hydrationErrors.push(message.text());
    }
  });
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
      name: "L14関係テスト",
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
  const projectId = (
    (await projectResponse.json()) as { project: { id: string } }
  ).project.id;
  const itemTypes = (
    (await (
      await page.request.get(`/api/projects/${projectId}/item-types`)
    ).json()) as { itemTypes: { id: string; name: string }[] }
  ).itemTypes;
  expect(itemTypes.length).toBeGreaterThanOrEqual(2);
  const sourceId = await createItem(
    page,
    projectId,
    itemTypes[0]!.id,
    "源流A",
    1880,
  );
  const targetId = await createItem(
    page,
    projectId,
    itemTypes[1]!.id,
    "後継B",
    1920,
  );

  await navigateWithDocumentLoad(
    page,
    `/projects/${projectId}/items/${sourceId}`,
  );
  const detailRelationships = page.getByTestId("relationship-manager");
  await expect(
    detailRelationships.getByRole("button", { name: "関係性を追加" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const manager = page.getByTestId("relationship-manager");
  await expect(manager).toBeVisible();
  await manager.getByLabel("終点", { exact: true }).selectOption(targetId);
  await manager.getByLabel("関係種別").fill("思想的継承");
  await manager.getByLabel("線", { exact: true }).selectOption("double");
  await manager.getByLabel("始点に矢印").check();
  await manager.getByLabel("注記").fill("グループをまたぐ関係");
  await manager.getByRole("button", { name: "関係性を追加" }).click();
  await expect(manager.getByText("思想的継承", { exact: true })).toBeVisible();
  await manager.getByRole("button", { name: "編集" }).click();
  await manager.getByLabel("関係種別").fill("継承");
  await manager.getByRole("button", { name: "関係性を更新" }).click();
  await expect(manager.getByText("継承", { exact: true })).toBeVisible();

  await navigateWithDocumentLoad(page, `/projects/${projectId}/timeline`);
  await page.getByRole("button", { name: "アイテムを追加" }).click();
  await page.getByRole("menuitem", { name: "タイムラインを追加" }).click();
  await expect(page.getByText("同時に追加する関係性")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("同時に追加する関係性")).toBeHidden();
  await page.getByRole("button", { name: "アイテムを追加" }).click();
  await page.getByRole("menuitem", { name: "イベントを追加" }).click();
  await expect(page.getByText("同時に追加する関係性")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("同時に追加する関係性")).toBeHidden();

  await page.getByRole("button", { name: "配置設定" }).click();
  await page
    .getByRole("menuitemcheckbox", { name: "タイムライン種別でグループ化" })
    .click();
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "すべて表示" }).click();
  const relationLine = page.getByRole("button", {
    name: /源流Aと後継Bの関係 継承/,
  });
  const relationshipStroke = page.locator(
    '[data-testid^="relationship-stroke-"]',
  );
  await expect(relationLine).toBeVisible();
  const relationClickPoint = await relationLine.evaluate((element) => {
    if (!(element instanceof SVGPathElement)) return null;
    const coordinates = element
      .getAttribute("d")
      ?.match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number);
    const svgBounds = element.ownerSVGElement?.getBoundingClientRect();
    if (!coordinates || coordinates.length < 8 || !svgBounds) return null;
    return {
      x: svgBounds.left + coordinates[6]!,
      y: svgBounds.top + coordinates[7]! - 12,
    };
  });
  if (!relationClickPoint) throw new Error("Relationship path is required.");
  await page.mouse.click(relationClickPoint.x, relationClickPoint.y);
  await expect(page.getByText("グループをまたぐ関係")).toBeVisible();
  await expect(relationshipStroke).toHaveAttribute("stroke", "#FF3399");
  await expect(page.getByTestId("relationship-popover")).not.toHaveCSS(
    "right",
    "12px",
  );
  await page
    .getByRole("heading", { name: "L14関係テスト", exact: true })
    .click();
  await expect(page.getByTestId("relationship-popover")).toBeHidden();
  await expect(relationshipStroke).toHaveAttribute("stroke", "#007F7F");
  await page.getByRole("button", { name: `${itemTypes[1]!.name} 1件` }).click();
  await page.getByRole("button", { name: "タイムライン操作を開く" }).click();
  await page.getByRole("button", { name: "全体に合わせる" }).click();
  await expect(page.getByTestId("relationship-layer")).toHaveAttribute(
    "data-visible-count",
    "1",
  );
  await expect(relationLine).toBeVisible();
  await relationLine.press("Enter");
  await expect(page.getByText("グループをまたぐ関係")).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();

  const viewport = page.getByTestId("timeline-viewport");
  await viewport.evaluate((element) => {
    element.scrollLeft = 120;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect
    .poll(() =>
      page
        .getByTestId("relationship-layer")
        .evaluate((element) => element.style.clipPath),
    )
    .toMatch(/ 120px\)$/);

  await page
    .getByTestId(`timeline-row-${sourceId}`)
    .getByRole("button", { name: "源流A", exact: true })
    .click();
  const detailDialog = page.getByRole("dialog");
  await expect(detailDialog).toBeVisible();
  const overlayCoversAxis = await Promise.all([
    detailDialog.boundingBox(),
    page.getByTestId("timeline-axis-header").boundingBox(),
  ]).then(([dialogBox, axisBox]) => {
    if (!dialogBox || !axisBox) return false;
    return page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[role='dialog']") !== null,
      {
        x: dialogBox.x + Math.min(40, dialogBox.width / 2),
        y: axisBox.y + axisBox.height / 2,
      },
    );
  });
  expect(overlayCoversAxis).toBe(true);

  await navigateWithDocumentLoad(
    page,
    `/projects/${projectId}/items/${sourceId}`,
  );
  await expect(
    page.getByRole("link", { name: "源流A", exact: true }),
  ).toHaveAttribute("href", `/projects/${projectId}/items/${sourceId}`);
  await expect(
    page.getByRole("link", { name: "後継B", exact: true }),
  ).toHaveAttribute("href", `/projects/${projectId}/items/${targetId}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const detailManager = page.getByTestId("relationship-manager");
  await detailManager.getByRole("button", { name: "削除" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "削除", exact: true }).click();
  await expect(
    detailManager.getByText("登録済みの関係性はありません。"),
  ).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
