import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

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

async function chooseDensity(page: Page, name: "標準" | "高密度") {
  await page.getByRole("button", { name: "表示密度設定" }).click();
  await page.getByRole("menuitemradio", { name }).click();
}

async function chooseLayout(page: Page, name: "行表示" | "コンパクト") {
  await page.getByRole("button", { name }).click();
}

async function toggleTypeGrouping(page: Page) {
  await page.getByRole("button", { name: "配置設定" }).click();
  await page
    .getByRole("menuitemcheckbox", { name: "対象種別でグループ化" })
    .click();
}

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
  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("A tree hydrated but some attributes")
    ) {
      hydrationWarnings.push(message.text());
    }
  });
  const authResponse = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(authResponse.status()).toBe(204);

  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "近代文学史",
      description:
        "作家と作品の関係を比較します。明治から現代までの人物、作品、出版、交流、社会背景を横断し、長い説明でもタイムライン領域を圧迫しないことを確認するためのプロジェクトです。",
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
  await expect(page.getByText(/作家と作品の関係を比較します。/)).toBeVisible();
  await expect(page.getByRole("button", { name: "続きを読む" })).toBeVisible();
  await page.getByRole("button", { name: "続きを読む" }).click();
  await page.getByRole("button", { name: "閉じる" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await expect(
    page.getByText("期間型・時点型の項目を登録し、同じ時間軸で比較します。"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", {
      name: "プロジェクト設定",
    }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.getByRole("button", { name: "対象種別", exact: true }).click();
  const desktopItemTypeDialog = page.getByRole("dialog");
  await expect(
    desktopItemTypeDialog.getByRole("heading", { name: "対象種別" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      desktopItemTypeDialog.evaluate(
        (element) => element.getBoundingClientRect().width,
      ),
    )
    .toBeGreaterThan(800);
  await desktopItemTypeDialog.getByRole("button", { name: "閉じる" }).click();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole("button", { name: "最初のタイムラインを作成" }).click();
  const rangeForm = page.getByRole("form", {
    name: "タイムラインアイテム作成",
  });
  await rangeForm.getByRole("button", { name: "対象種別を編集" }).click();
  const itemTypeDialog = page.getByRole("dialog").last();
  await itemTypeDialog.getByLabel("対象種別を検索・新規作成").fill("出来事");
  await itemTypeDialog.getByRole("button", { name: "新規作成" }).click();
  await expect(
    itemTypeDialog.getByRole("textbox", { name: "名称" }).last(),
  ).toHaveValue("出来事");
  await itemTypeDialog.getByRole("button", { name: "閉じる" }).click();
  await expect(rangeForm.getByLabel("対象種別", { exact: true })).toContainText(
    "出来事",
  );

  await rangeForm.getByLabel("名称").fill("夏目漱石");
  const rangeYears = rangeForm.getByLabel("年");
  await rangeYears.nth(0).fill("1867");
  await rangeYears.nth(1).fill("1916");
  await rangeForm.getByLabel("開始日はおおよそ").check();
  await rangeForm.getByLabel("本文").fill("明治・大正期の小説家");
  await rangeForm.getByLabel("出典・参考文献").fill("人物事典 第一巻");
  await rangeForm.getByLabel("外部URL").fill("https://example.com/");
  await rangeForm.getByLabel("対象種別の色を上書き").check();
  await expect(rangeForm.getByLabel("個別色カラーピッカー")).toBeVisible();
  await rangeForm.getByRole("button", { name: "イベントを追加" }).click();
  const eventDraftForm = rangeForm.getByRole("group", {
    name: "同時追加するイベントアイテム",
  });
  await eventDraftForm.getByLabel("タイトル").fill("ロンドン留学");
  await eventDraftForm.getByLabel("イベント年").fill("1900");
  await eventDraftForm.getByRole("button", { name: "下書きに追加" }).click();
  await rangeForm
    .getByRole("button", { name: "タイムラインアイテムを作成" })
    .click();

  await expect(page.getByText("夏目漱石", { exact: true })).toBeVisible();
  const rangeGlyph = page.getByLabel(/夏目漱石.*期間型バー/);
  await expect(rangeGlyph).toBeVisible();
  await expect(
    page.getByRole("button", { name: /イベントアイテム ロンドン留学/ }),
  ).toBeVisible();
  await rangeGlyph.hover();
  const itemTooltip = page
    .getByRole("tooltip")
    .filter({ hasText: "夏目漱石" })
    .last();
  await expect(itemTooltip).toContainText("約 1867 — 1916");
  await expect(itemTooltip).not.toContainText("登録日付");
  await page.getByRole("button", { name: "夏目漱石", exact: true }).click();
  const itemDetail = page.getByRole("dialog");
  await expect(itemDetail.locator("h1")).toHaveText("夏目漱石");
  await expect(itemDetail).toContainText("明治・大正期の小説家");
  await expect(itemDetail.getByText("本文", { exact: true })).toHaveCount(0);
  await itemDetail.getByRole("link", { name: "編集" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/items/[0-9a-f-]+/edit$`),
  );
  await expect(
    page.getByRole("dialog").getByRole("form", {
      name: "タイムラインアイテム編集",
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog").locator("h1")).toHaveText("夏目漱石");
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "アイテムを追加" }).click();
  await expect(
    page.getByRole("menuitem", { name: "イベントを追加" }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "タイムラインを追加" }).click();
  const pointForm = page.getByRole("form", {
    name: "タイムラインアイテム作成",
  });
  await pointForm.getByLabel("名称").fill("『吾輩は猫である』刊行");
  await pointForm.getByLabel("年").first().fill("1905");
  await pointForm.getByRole("button", { name: "時点" }).click();
  await expect(pointForm.getByLabel("年")).toHaveValue("1905");
  await pointForm
    .getByRole("button", { name: "タイムラインアイテムを作成" })
    .click();

  await expect(
    page.getByText("『吾輩は猫である』刊行", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/時点型マーカー/)).toBeVisible();
  await page
    .getByRole("button", { name: "『吾輩は猫である』刊行", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "『吾輩は猫である』刊行",
  );
  await expect(page.getByRole("dialog")).toContainText("タイムラインアイテム");
  await page.goBack();

  const zoomSlider = page.getByLabel("ズーム段階");
  const viewport = page.getByTestId("timeline-viewport");
  await viewport.dispatchEvent("wheel", {
    altKey: true,
    deltaY: -100,
    clientX: 600,
  });
  await expect(zoomSlider).toHaveValue("1");
  await viewport.dispatchEvent("wheel", {
    ctrlKey: true,
    deltaY: -100,
    clientX: 600,
  });
  await expect(zoomSlider).toHaveValue("1");
  await zoomSlider.fill("3");
  await expect(zoomSlider).toHaveValue("3");
  const beforePan = await viewport.evaluate((element) => element.scrollLeft);
  const findPanPoints = () =>
    viewport.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      for (let y = rect.top + 8; y < rect.bottom - 8; y += 8) {
        const points: number[] = [];
        for (let x = rect.left + 8; x < rect.right - 8; x += 8) {
          if (
            document
              .elementFromPoint(x, y)
              ?.closest("[data-timeline-pan-surface='true']")
          ) {
            points.push(x);
          }
        }
        if (points.length > 16) {
          return {
            startX: points.at(-1)!,
            endX: points[0]!,
            y,
          };
        }
      }
      return null;
    });
  await expect.poll(findPanPoints).not.toBeNull();
  const panPoints = await findPanPoints();
  if (!panPoints) throw new Error("Timeline pan surface is not visible.");
  await page.mouse.move(panPoints.startX, panPoints.y);
  await page.mouse.down();
  await expect(page.getByLabel(/期間型バー/).first()).toBeVisible();
  await page.mouse.move(panPoints.endX, panPoints.y);
  await expect(page.getByLabel(/期間型バー/).first()).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(beforePan);
  await chooseDensity(page, "高密度");
  await expect(
    page.getByRole("button", { name: "表示密度設定" }),
  ).toContainText("高密度");
  await expect(page.getByTestId(/^timeline-row-/).first()).toHaveCSS(
    "height",
    "44px",
  );
  await chooseDensity(page, "標準");
  await expect(page.getByTestId(/^timeline-row-/).first()).toHaveCSS(
    "height",
    "64px",
  );
  await page.getByRole("button", { name: "全体に合わせる" }).click();
  await expect(zoomSlider).toHaveValue("0");

  const moveUp = page.getByRole("button", {
    name: "『吾輩は猫である』刊行を上へ移動",
  });
  await moveUp.focus();
  await page.keyboard.press("Enter");
  const rows = page.locator("[data-testid^='timeline-row-']");
  await expect(rows.first()).toContainText("『吾輩は猫である』刊行");

  await toggleTypeGrouping(page);
  const personGroup = page.getByRole("button", { name: /人物/ });
  await expect(personGroup).toBeVisible();
  await personGroup.click();
  await expect(page.getByText("夏目漱石", { exact: true })).toBeHidden();
  await personGroup.click();

  await toggleTypeGrouping(page);
  await chooseLayout(page, "コンパクト");
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/timeline\\?layout=compact$`),
  );
  await expect(page.getByRole("button", { name: "配置設定" })).toContainText(
    "自動配置",
  );
  await expect(page.getByTestId(/^timeline-row-/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "夏目漱石の詳細を表示", exact: true }),
  ).toBeVisible();
  const compactLanes = page.getByTestId(/^compact-lane-/);
  const compactLaneCount = await compactLanes.count();
  expect(compactLaneCount).toBeGreaterThan(0);
  await zoomSlider.fill("2");
  await expect(compactLanes).toHaveCount(compactLaneCount);

  await viewport.evaluate((element) => {
    element.style.flex = "none";
    element.style.minHeight = "0";
    element.style.height = "80px";
  });
  await expect
    .poll(() =>
      viewport.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);
  await viewport.hover();
  await page.mouse.wheel(0, 100);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "コンパクト" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId(/^compact-lane-/).first()).toBeVisible();
  await chooseLayout(page, "行表示");
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/timeline\\?layout=row$`),
  );
  await expect(page.getByTestId(/^timeline-row-/)).toHaveCount(2);

  await page.getByRole("button", { name: "夏目漱石を編集" }).click();
  const editForm = page.getByRole("form", {
    name: "タイムラインアイテム編集",
  });
  await expect(editForm.getByText("詳細編集を開く")).toHaveCount(0);
  await expect(editForm.getByLabel("本文")).toHaveValue("明治・大正期の小説家");
  await expect(editForm.getByLabel("出典・参考文献")).toHaveValue(
    "人物事典 第一巻",
  );
  await expect(editForm.getByLabel("外部URL")).toHaveValue(
    "https://example.com/",
  );
  await expect(editForm.getByLabel(/概要/)).toHaveCount(0);
  await editForm.getByLabel("タイムラインに表示").uncheck();
  await editForm.getByRole("button", { name: "変更を保存" }).click();
  await expect(editForm).toBeHidden();

  const hiddenGroup = page.getByRole("button", {
    name: "非表示にした項目 1件",
  });
  await expect(hiddenGroup).toBeVisible();
  await expect(page.getByText("夏目漱石", { exact: true })).toBeHidden();
  await expect(page.getByText(/表示中 1 \/ 2 行/)).toBeVisible();
  await hiddenGroup.click();
  await page.getByRole("button", { name: "夏目漱石を編集" }).click();
  await page.getByRole("button", { name: "完全削除" }).click();
  await page.getByRole("button", { name: "完全削除" }).last().click();
  await expect(page.getByText("夏目漱石", { exact: true })).toBeHidden();
  await page.reload();
  await expect(page.getByLabel(/時点型マーカー/)).toBeVisible();
  await expect(page.getByText(/目盛り year/)).toBeVisible();
  expect(hydrationWarnings).toEqual([]);
});
