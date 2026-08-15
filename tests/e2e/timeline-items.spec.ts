import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { navigateWithDocumentLoad } from "./helpers/navigation";
import { postAfterConnectionReset } from "./helpers/request";

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
  const settings = page.getByRole("button", { name: "表示密度設定" });
  await settings.click();
  await page.getByRole("menuitemradio", { name }).click();
}

async function chooseLayout(page: Page, name: "行表示" | "コンパクト") {
  await page.getByRole("button", { name }).click();
}

async function toggleTypeGrouping(page: Page) {
  await page.getByRole("button", { name: "配置設定" }).click();
  await page.getByRole("menuitemcheckbox", { name: "グループ化" }).click();
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
  test.slow();
  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("A tree hydrated but some attributes")
    ) {
      hydrationWarnings.push(message.text());
    }
  });
  const authResponse = await postAfterConnectionReset(
    page.request,
    "/api/test-auth",
    {
      data: { email, password },
      headers: { "x-test-auth-secret": authSecret },
    },
  );
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

  await page.getByRole("button", { name: "フィルター" }).click();
  const filterDialog = page.getByRole("dialog");
  const filterQuery = filterDialog.getByLabel("タイムライン内検索");
  await filterQuery.pressSequentially("k");
  await expect(filterQuery).toHaveValue("k");
  await expect
    .poll(() =>
      page
        .locator('[data-slot="sheet-overlay"]')
        .evaluate((element) => getComputedStyle(element).backdropFilter),
    )
    .toBe("none");
  await filterDialog
    .getByRole("button", { name: "フィルターをリセット" })
    .click();
  await filterDialog.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page.getByRole("menuitem", { name: "プロジェクト設定・共有" }).click();
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
  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page.getByRole("menuitem", { name: "分類・関係" }).click();
  const desktopItemTypeDialog = page.getByRole("dialog");
  await expect(
    desktopItemTypeDialog.getByRole("heading", {
      name: "分類・関係",
    }),
  ).toBeVisible();
  await expect(
    desktopItemTypeDialog.getByRole("combobox", {
      name: "タイムライン種別を検索または作成",
    }),
  ).not.toBeFocused();
  const classificationHeadings = await desktopItemTypeDialog
    .locator("h2")
    .allTextContents();
  expect(
    classificationHeadings.filter((heading) =>
      [
        "タイムライン種別",
        "イベント種別",
        "タグの統合",
        "カスタムフィールド",
      ].includes(heading.trim()),
    ),
  ).toEqual([
    "タイムライン種別",
    "イベント種別",
    "タグの統合",
    "カスタムフィールド",
  ]);
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
  const itemTypeInput = rangeForm.getByRole("combobox", {
    name: "タイムライン種別を検索または作成",
  });
  await itemTypeInput.fill("出来事");
  await itemTypeInput.press("Enter");
  await expect(
    rangeForm.getByText("出来事", { exact: true }).first(),
  ).toBeVisible();
  await itemTypeInput.click();
  await rangeForm.getByRole("button", { name: "出来事の設定変更" }).click();
  await expect(
    rangeForm.getByText("オプションを選択するか作成します"),
  ).toBeVisible();
  const iconUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes("/item-types/"),
  );
  await rangeForm.getByRole("button", { name: "作品アイコン" }).click();
  expect((await iconUpdate).ok()).toBe(true);
  await expect(
    rangeForm.getByRole("button", { name: "作品アイコン" }),
  ).toHaveAttribute("aria-pressed", "true");
  await rangeForm.getByLabel("名称").click();
  await expect(
    rangeForm.getByText("オプションを選択するか作成します"),
  ).toHaveCount(0);

  await rangeForm.getByLabel("名称").fill("夏目漱石");
  const rangeYears = rangeForm.getByLabel("年");
  await rangeYears.nth(0).fill("1867");
  await rangeYears.nth(1).fill("1916");
  await rangeForm.getByLabel("開始日はおおよそ").check();
  await rangeForm.getByLabel("本文").fill("明治・大正期の小説家");
  await rangeForm.getByLabel("出典・参考文献").fill("人物事典 第一巻");
  await rangeForm.getByLabel("外部URL").fill("https://example.com/");
  await rangeForm.getByLabel("タイムライン種別の色を上書き").check();
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
  await page.getByRole("button", { name: "配置設定" }).click();
  await page
    .getByRole("menuitemcheckbox", {
      name: "グループ化",
    })
    .click();
  const typeGroup = page.getByRole("button", { name: /出来事 1件/ });
  await expect(typeGroup.locator("svg.lucide-image")).toBeVisible();
  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page.getByRole("menuitem", { name: "分類・関係" }).click();
  const classificationDialog = page.getByRole("dialog");
  await classificationDialog
    .getByRole("combobox", {
      name: "タイムライン種別を検索または作成",
    })
    .click();
  await classificationDialog
    .getByRole("button", { name: "出来事の設定変更" })
    .click();
  const iconRefresh = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes("/item-types/"),
  );
  await classificationDialog
    .getByRole("button", { name: "政治・社会アイコン" })
    .click();
  expect((await iconRefresh).ok()).toBe(true);
  const colorRefresh = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes("/item-types/"),
  );
  await classificationDialog
    .getByRole("button", { name: "色 #FF3399" })
    .click();
  expect((await colorRefresh).ok()).toBe(true);
  await classificationDialog.locator("[data-slot='sheet-close']").click();
  await expect(typeGroup.locator("svg.lucide-landmark")).toHaveCSS(
    "color",
    "rgb(255, 51, 153)",
  );
  await rangeGlyph.hover();
  const itemTooltip = page
    .getByRole("tooltip")
    .filter({ hasText: "夏目漱石" })
    .last();
  await expect(itemTooltip).toContainText("1867 頃 — 1916");
  await expect(itemTooltip).not.toContainText("登録日付");
  await page.getByRole("button", { name: "夏目漱石", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/items/[0-9a-f-]+$`),
  );
  const rangeItemId = page.url().split("/").at(-1)!;
  const itemDetail = page.getByRole("dialog");
  await expect(
    itemDetail.getByRole("article").getByRole("heading", {
      level: 1,
      name: "夏目漱石",
    }),
  ).toBeVisible();
  await expect(itemDetail).toContainText("明治・大正期の小説家");
  await expect(itemDetail.getByText("本文", { exact: true })).toHaveCount(0);
  await itemDetail.getByText("イベント 1件").click();
  await expect(
    itemDetail.getByRole("link", { name: "ロンドン留学" }),
  ).toBeVisible();
  await expect(itemDetail.getByText("1900")).toBeVisible();
  await itemDetail.getByRole("link", { name: "ロンドン留学" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/events/[0-9a-f-]+$`),
  );
  await expect(page.getByRole("dialog")).toContainText("ロンドン留学");
  await navigateWithDocumentLoad(page, `/projects/${projectId}/timeline`);
  await page.getByRole("button", { name: "夏目漱石", exact: true }).click();
  await expect(
    itemDetail.getByRole("article").getByRole("heading", {
      level: 1,
      name: "夏目漱石",
    }),
  ).toBeVisible();
  const detailUrl = page.url();
  await itemDetail.getByRole("button", { name: "詳細オプション" }).click();
  await page.getByRole("menuitem", { name: "編集" }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(
    page.getByRole("dialog").getByRole("form", {
      name: "タイムラインアイテム編集",
    }),
  ).toBeVisible();
  const itemOverlayEditForm = page
    .getByRole("dialog")
    .getByRole("form", { name: "タイムラインアイテム編集" });
  const cloudSaveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().includes("/cloud-drafts/"),
  );
  await itemOverlayEditForm
    .getByLabel("本文")
    .fill(
      "# 更新後の人物本文\n\n**強調表示**\n\n> [!NOTE]\n> 即時プレビュー\n\n<script>alert('xss')</script>\n\n![非対応画像](https://example.com/image.png)",
    );
  const cloudSaveResponse = await cloudSaveResponsePromise;
  expect(cloudSaveResponse.ok(), await cloudSaveResponse.text()).toBe(true);
  await expect(
    itemOverlayEditForm.getByText("クラウド下書き保存済み", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  const cloudDraftBeforeSave = (await (
    await page.request.get(
      `/api/projects/${projectId}/cloud-drafts/timeline_item/${rangeItemId}`,
    )
  ).json()) as {
    draft: {
      value: { values: { description: string } };
      version: number;
      baseVersion: string | null;
      writerId: string;
    } | null;
  };
  expect(cloudDraftBeforeSave.draft?.value.values.description).toContain(
    "更新後の人物本文",
  );
  const staleCloudWrite = await page.request.put(
    `/api/projects/${projectId}/cloud-drafts/timeline_item/${rangeItemId}`,
    {
      data: {
        value: { values: { description: "競合する端末の入力" } },
        baseVersion: cloudDraftBeforeSave.draft!.baseVersion,
        fingerprint: "stale-writer",
        writerId: "stale-device",
        expectedVersion: cloudDraftBeforeSave.draft!.version + 1,
      },
    },
  );
  expect(staleCloudWrite.status()).toBe(409);
  const beforeExplicitSave = (await (
    await page.request.get(`/api/projects/${projectId}/items/${rangeItemId}`)
  ).json()) as { item: { description: string | null } };
  expect(beforeExplicitSave.item.description).toBe("明治・大正期の小説家");

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("chronology-studio-drafts");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB delete blocked"));
      }),
  );
  await page.reload();
  await page.getByRole("button", { name: "詳細オプション" }).click();
  await page.getByRole("menuitem", { name: "編集" }).click();
  const restoredItemEditForm = page.getByRole("form", {
    name: "タイムラインアイテム編集",
  });
  await expect(restoredItemEditForm.getByLabel("本文")).toHaveValue(
    "# 更新後の人物本文\n\n**強調表示**\n\n> [!NOTE]\n> 即時プレビュー\n\n<script>alert('xss')</script>\n\n![非対応画像](https://example.com/image.png)",
  );
  await expect(
    restoredItemEditForm.getByRole("button", { name: "分割" }),
  ).toHaveCount(0);
  await restoredItemEditForm
    .getByRole("button", { name: "プレビュー" })
    .click();
  await expect(
    restoredItemEditForm.getByRole("region", { name: "Markdownプレビュー" }),
  ).toContainText("即時プレビュー");
  await expect(restoredItemEditForm.locator("script, img")).toHaveCount(0);
  await restoredItemEditForm
    .getByRole("button", { name: "変更を保存" })
    .click();
  await expect(
    page.getByRole("article").getByRole("heading", {
      level: 1,
      name: "夏目漱石",
    }),
  ).toBeVisible();
  const cloudDraftAfterSave = (await (
    await page.request.get(
      `/api/projects/${projectId}/cloud-drafts/timeline_item/${rangeItemId}`,
    )
  ).json()) as { draft: unknown };
  expect(cloudDraftAfterSave.draft).toBeNull();
  await navigateWithDocumentLoad(page, `/projects/${projectId}/timeline`);
  await page.getByRole("button", { name: "夏目漱石", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("article").getByRole("heading", {
      level: 1,
      name: "夏目漱石",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", {
      name: "更新後の人物本文",
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByText("強調表示")).toHaveCSS(
    "font-weight",
    "700",
  );
  await expect(page.getByRole("dialog").locator("script, img")).toHaveCount(0);
  await itemDetail.getByRole("button", { name: "編集" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("form", {
        name: "タイムラインアイテム編集",
      })
      .getByLabel("本文"),
  ).toHaveValue(
    "# 更新後の人物本文\n\n**強調表示**\n\n> [!NOTE]\n> 即時プレビュー\n\n<script>alert('xss')</script>\n\n![非対応画像](https://example.com/image.png)",
  );
  await itemDetail.getByRole("button", { name: "詳細オプション" }).click();
  await page.getByRole("menuitem", { name: "閲覧に戻る" }).click();
  await itemDetail.getByRole("button", { name: "詳細オプション" }).click();
  await page.getByRole("menuitem", { name: "変更履歴" }).click();
  const historyDialog = page.getByRole("dialog", { name: "変更履歴" });
  await expect(historyDialog.getByText("本文", { exact: true })).toBeVisible();
  await expect(historyDialog.getByText("明治・大正期の小説家")).toBeVisible();
  await expect(historyDialog.getByText("更新後の人物本文")).toBeVisible();
  await historyDialog
    .getByRole("button", { name: "チェックポイントを作成" })
    .click();
  await expect(historyDialog.getByText("手動チェックポイント")).toBeVisible();
  await historyDialog.getByRole("button", { name: "閉じる" }).click();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await navigateWithDocumentLoad(
    page,
    `/projects/${projectId}/items/${rangeItemId}`,
  );
  await page.getByText("イベント 1件").click();
  await page.getByRole("link", { name: "ロンドン留学" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/events/[0-9a-f-]+$`),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigateWithDocumentLoad(page, `/projects/${projectId}/timeline`);

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
  await expect(zoomSlider).toHaveAttribute("max", "10");
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
  await expect(page.getByTestId("timeline-toolbar-controls")).toBeVisible();
  await expect(page.getByTestId("timeline-time-slicer")).toHaveCount(0);
  const timeSlicerToggle = page.getByRole("button", {
    name: "期間強調表示",
  });
  await expect(timeSlicerToggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("全期間ミニマップ")).toHaveCount(0);
  await timeSlicerToggle.click();
  await expect(timeSlicerToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("timeline-time-slicer")).toBeVisible();
  const sliceStart = page.getByLabel("強調期間の始点");
  const sliceEnd = page.getByLabel("強調期間の終点");
  const sliceMin = Number(await sliceStart.getAttribute("min"));
  const sliceMax = Number(await sliceEnd.getAttribute("max"));
  await sliceStart.fill(
    String(Math.round(sliceMin + (sliceMax - sliceMin) / 4)),
  );
  await sliceEnd.fill(String(Math.round(sliceMax - (sliceMax - sliceMin) / 4)));
  await expect(page.getByTestId("time-slice-before")).toBeAttached();
  await expect(page.getByTestId("time-slice-after")).toBeAttached();
  await expect(page.getByTestId("time-slice-selected")).toBeAttached();
  const fixedColumnRects = await page
    .getByTestId(/^timeline-row-/)
    .first()
    .locator("[data-timeline-fixed-column]")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    );
  expect(fixedColumnRects).toHaveLength(3);
  const highlightLayerRect = await page
    .getByTestId("timeline-period-highlight-layer")
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
  expect(highlightLayerRect.left).toBeGreaterThanOrEqual(
    fixedColumnRects[1].right,
  );
  expect(highlightLayerRect.right).toBeLessThanOrEqual(
    fixedColumnRects[2].left,
  );
  await expect(page.getByTestId("timeline-highlight-range")).toBeVisible();
  await timeSlicerToggle.click();
  await expect(timeSlicerToggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("timeline-time-slicer")).toHaveCount(0);
  await expect(page.getByTestId("time-slice-before")).toHaveCount(0);
  await timeSlicerToggle.click();
  await expect(page.getByTestId("timeline-time-slicer")).toBeVisible();
  await timeSlicerToggle.click();
  await expect(page.getByTestId("timeline-time-slicer")).toHaveCount(0);
  await viewport.hover({ position: { x: 620, y: 100 } });
  await expect(page.getByTestId("timeline-pointer-guide")).toBeVisible();

  await page.getByRole("button", { name: "画面", exact: true }).click();
  await page.getByRole("menuitem", { name: "最大化", exact: true }).click();
  await expect(page.getByTestId("timeline-workspace")).toHaveAttribute(
    "data-maximized",
    "true",
  );
  await page.getByRole("button", { name: "アイテムを追加" }).click();
  await page.getByRole("menuitem", { name: "タイムラインを追加" }).click();
  await expect(
    page.getByRole("heading", { name: "タイムラインアイテムを追加" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "フィルター" }).click();
  await expect(
    page.getByRole("heading", { name: "タイムラインを絞り込む" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("timeline-workspace")).toHaveAttribute(
    "data-maximized",
    "false",
  );

  await page.getByRole("button", { name: "画面", exact: true }).click();
  const fullscreenItem = page.getByRole("menuitem", { name: "全画面" });
  if ((await fullscreenItem.count()) > 0) {
    await fullscreenItem.click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement !== null))
      .toBe(true);
    await page.getByRole("button", { name: "アイテムを追加" }).click();
    await page.getByRole("menuitem", { name: "タイムラインを追加" }).click();
    await expect(
      page.getByRole("heading", { name: "タイムラインアイテムを追加" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.getByRole("button", { name: "フィルター" }).click();
    await expect(
      page.getByRole("heading", { name: "タイムラインを絞り込む" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.evaluate(() => document.exitFullscreen());
  } else {
    await page.keyboard.press("Escape");
  }

  await page.getByRole("button", { name: "移動・ビュー", exact: true }).click();
  await page.getByLabel("保存済みビュー名").fill("明治期ビュー");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "移動・ビュー", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "明治期ビュー" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const moveUp = page.getByRole("button", {
    name: "『吾輩は猫である』刊行を上へ移動",
  });
  await moveUp.focus();
  await page.keyboard.press("Enter");
  const rows = page.locator("[data-testid^='timeline-row-']");
  await expect(rows.first()).toContainText("『吾輩は猫である』刊行");

  await toggleTypeGrouping(page);
  const createdTypeGroup = page.getByRole("button", { name: /出来事/ });
  await expect(createdTypeGroup).toBeVisible();
  await expect(createdTypeGroup.locator("svg.lucide-landmark")).toHaveCSS(
    "color",
    "rgb(255, 51, 153)",
  );
  await createdTypeGroup.click();
  await expect(page.getByText("夏目漱石", { exact: true })).toBeHidden();
  await createdTypeGroup.click();

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
  await expect(editForm.getByLabel("本文")).toHaveValue(
    "# 更新後の人物本文\n\n**強調表示**\n\n> [!NOTE]\n> 即時プレビュー\n\n<script>alert('xss')</script>\n\n![非対応画像](https://example.com/image.png)",
  );
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
  await page.getByRole("button", { name: "夏目漱石", exact: true }).click();
  const deleteDetail = page.getByRole("dialog");
  await deleteDetail.getByRole("button", { name: "詳細オプション" }).click();
  await page.getByRole("menuitem", { name: "ゴミ箱へ移動" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "ゴミ箱へ移動" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/timeline(?:\\?.*)?$`),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("夏目漱石", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page.getByRole("menuitem", { name: "プロジェクト設定・共有" }).click();
  const trashSettings = page.getByRole("dialog", {
    name: "プロジェクト設定",
  });
  const trashEntry = trashSettings
    .getByRole("listitem")
    .filter({ hasText: "夏目漱石" });
  await expect(trashEntry).toBeVisible();
  await trashEntry.getByRole("button", { name: "復元" }).click();
  await expect(trashEntry).toBeHidden();
  await trashSettings.getByRole("button", { name: "閉じる" }).click();
  await page.reload();
  await expect(page.getByLabel(/時点型マーカー/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "非表示にした項目 1件" }),
  ).toBeVisible();
  await expect(page.getByText(/目盛り decade/)).toBeVisible();
  expect(hydrationWarnings).toEqual([]);
});

test("creates a BCE century and draws it on the continuous historical axis", async ({
  page,
}) => {
  const authResponse = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(authResponse.status()).toBe(204);
  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "古代史",
      description: null,
      template: "general",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1,
        initialEndYear: 2026,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
    },
  });
  expect(projectResponse.status()).toBe(201);
  const body = (await projectResponse.json()) as { project: { id: string } };
  await page.goto(`/projects/${body.project.id}/timeline`);
  await page.getByRole("button", { name: "最初のタイムラインを作成" }).click();
  const form = page.getByRole("form", { name: "タイムラインアイテム作成" });
  await form.getByLabel("名称").fill("古代ギリシア");
  await form.getByLabel("時代").first().selectOption("bce");
  await form.getByLabel("日付精度").first().selectOption("century");
  await form.getByLabel("世紀").fill("5");
  await form.getByLabel("日付表記の手動入力").first().fill("古典期");
  await form.getByLabel("年").fill("1");
  await expect(form.getByText("表記プレビュー: 古典期")).toBeVisible();
  await form
    .getByRole("button", { name: "タイムラインアイテムを作成" })
    .click();
  const glyph = page.getByLabel(/古代ギリシア.*期間型バー/);
  await expect(glyph).toBeVisible();
  await glyph.hover();
  await expect(page.getByRole("tooltip").last()).toContainText("古典期 — 1");
  await expect(page.getByText(/紀元前/).first()).toBeVisible();
});
