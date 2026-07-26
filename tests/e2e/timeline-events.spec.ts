import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `timeline-events-e2e-${crypto.randomUUID()}@example.com`;
const password = `TimelineEvents-${crypto.randomUUID()}`;
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

test("creates an event from a row and preserves the timeline in URL overlays", async ({
  page,
}) => {
  test.setTimeout(60_000);
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
      name: "イベントアイテム検証",
      description: null,
      template: "general",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1890,
        initialEndYear: 1920,
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
  const itemResponse = await page.request.post(
    `/api/projects/${project.id}/items`,
    {
      data: {
        typeId: itemTypes[0]!.id,
        title: "親人物",
        description: "",
        sourceText: "",
        externalUrl: "",
        temporalType: "range",
        colorOverride: null,
        isVisible: true,
        start: { year: 1900, month: 1, day: 1 },
        isStartApproximate: false,
        endDateStatus: "specified",
        end: { year: 1910, month: 12, day: 31 },
        isEndApproximate: false,
        lastConfirmed: null,
        point: null,
        isPointApproximate: false,
      },
    },
  );
  const { item } = (await itemResponse.json()) as { item: { id: string } };

  await page.goto(`/projects/${project.id}/timeline`);
  await page.getByRole("button", { name: "アイテムを追加" }).click();
  await page.getByRole("menuitem", { name: "イベントを追加" }).click();
  const sideForm = page.getByRole("form", { name: "イベントアイテム作成" });
  await sideForm.getByLabel("親タイムラインアイテム").selectOption(item.id);
  await sideForm.getByLabel("タイトル").fill("初期作品");
  await sideForm.getByLabel("イベント年").fill("1903");
  await sideForm
    .getByRole("button", { name: "イベントアイテムを作成" })
    .click();
  await page.getByRole("button", { name: "全体に合わせる" }).click();
  await expect(
    page.getByRole("button", { name: /イベントアイテム 初期作品/ }),
  ).toBeVisible();

  const surface = page
    .getByTestId(`timeline-row-${item.id}`)
    .locator("[data-timeline-pan-surface='true']");
  const box = await surface.boundingBox();
  if (!box) throw new Error("Timeline row is required.");
  await surface.dblclick({
    position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) },
  });
  const createForm = page.getByRole("form", {
    name: "イベントアイテム作成",
  });
  await expect(createForm).toBeVisible();
  await expect(createForm.getByLabel("親タイムラインアイテム")).toHaveValue(
    item.id,
  );
  await createForm.getByLabel("タイトル").fill("代表作刊行");
  await createForm.getByLabel("イベント年").fill("1905");
  await createForm.getByLabel("イベント月").fill("1");
  await createForm.getByLabel("イベント日").fill("15");
  await expect(page.getByLabel(/仮マーカー/)).toBeVisible();
  await createForm
    .getByRole("button", { name: "イベントアイテムを作成" })
    .click();
  await page.getByRole("button", { name: "全体に合わせる" }).click();

  const marker = page.getByRole("button", {
    name: /イベントアイテム 代表作刊行/,
  });
  await expect(marker).toBeVisible();
  const parentGlyph = page.getByRole("button", {
    name: /親人物の詳細を表示 期間型バー/,
  });
  await parentGlyph.hover({ position: { x: 2, y: 2 } });
  await expect(
    page.getByRole("tooltip").filter({ hasText: "親人物" }).last(),
  ).toBeVisible();
  await marker.hover();
  await expect
    .poll(() => marker.evaluate((element) => element.matches(":hover")))
    .toBe(true);
  await expect
    .poll(() => parentGlyph.evaluate((element) => element.matches(":hover")))
    .toBe(false);
  await page.mouse.move(0, 0);
  await expect(
    page.getByRole("tooltip").filter({ hasText: "親人物" }).last(),
  ).toBeHidden();
  await marker.hover();
  await expect(
    page.getByRole("tooltip").filter({ hasText: "代表作刊行" }).last(),
  ).toContainText("1905/01/15");
  await expect(
    page.getByRole("tooltip").filter({ hasText: "代表作刊行" }).last(),
  ).not.toContainText("登録日付");
  await marker.click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project.id}/events/[0-9a-f-]+$`),
  );
  const detailDialog = page.getByRole("dialog");
  await expect(detailDialog).toContainText("代表作刊行");
  await expect(detailDialog.getByText("親人物", { exact: true })).toBeVisible();
  const eventId = page.url().split("/").at(-1)!;

  await detailDialog.getByRole("button", { name: "全画面で表示" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "代表作刊行" })).toBeVisible();
  await page.goto(`/projects/${project.id}/timeline`);
  await marker.click();

  await detailDialog.getByRole("link", { name: "編集" }).click();
  const overlayEditForm = page
    .getByRole("dialog")
    .getByRole("form", { name: "イベントアイテム編集" });
  await expect(overlayEditForm).toBeVisible();
  const [dialogBox, formBox] = await Promise.all([
    page.getByRole("dialog").boundingBox(),
    overlayEditForm.boundingBox(),
  ]);
  expect(dialogBox).not.toBeNull();
  expect(formBox).not.toBeNull();
  expect(formBox!.x - dialogBox!.x).toBeGreaterThanOrEqual(24);

  await overlayEditForm.getByLabel("本文").fill("更新後イベント本文");
  await overlayEditForm.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    overlayEditForm.getByRole("button", { name: "変更を保存" }),
  ).toBeEnabled();
  await page.goBack();
  await expect(page.getByRole("dialog")).toContainText("代表作刊行");
  await expect(page.getByRole("dialog")).toContainText("更新後イベント本文");
  await page.goBack();
  await expect(page).toHaveURL(`/projects/${project.id}/timeline`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await marker.dblclick();
  await expect(page).toHaveURL(
    `/projects/${project.id}/events/${eventId}/edit`,
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("form", { name: "イベントアイテム編集" }),
  ).toBeVisible();

  await page.goto(`/projects/${project.id}/events/${eventId}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "代表作刊行" })).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "パンくず" });
  await expect(
    breadcrumb.getByRole("link", { name: "親人物" }),
  ).toHaveAttribute("href", `/projects/${project.id}/items/${item.id}`);
  await breadcrumb.getByRole("link", { name: "親人物" }).click();
  await expect(page).toHaveURL(`/projects/${project.id}/items/${item.id}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  for (const title of ["クラスタ候補A", "クラスタ候補B"]) {
    const response = await page.request.post(
      `/api/projects/${project.id}/events`,
      {
        data: {
          timelineItemId: item.id,
          title,
          date: { year: 1905, month: 1, day: 15 },
          isApproximate: false,
          description: "",
          sourceText: "",
          externalUrl: "",
        },
      },
    );
    expect(response.ok()).toBe(true);
  }

  await page.goto(`/projects/${project.id}/timeline`);
  const cluster = page.getByRole("button", {
    name: "3件のイベントアイテムを選択",
  });
  await expect(cluster).toBeVisible();
  await cluster.click({ force: true });

  const picker = page.getByRole("dialog");
  await expect(picker).toContainText("イベントを選択");
  const clusterChoice = picker.getByRole("button", { name: /クラスタ候補A/ });
  const initialChoiceBackground = await clusterChoice.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await clusterChoice.hover();
  await expect
    .poll(() =>
      clusterChoice.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(initialChoiceBackground);
  await clusterChoice.click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project.id}/events/[0-9a-f-]+$`),
  );
  await expect(page.getByRole("dialog")).toContainText("クラスタ候補A");

  let finishDelete: (() => void) | undefined;
  const deleteGate = new Promise<void>((resolve) => {
    finishDelete = resolve;
  });
  await page.route(`**/api/projects/${project.id}/events/*`, async (route) => {
    if (route.request().method() === "DELETE") await deleteGate;
    await route.continue();
  });
  page.once("dialog", (dialog) => void dialog.accept());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "完全削除" })
    .click();
  await expect(
    page.getByRole("status", { name: "イベントを削除しています" }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project.id}/events/[0-9a-f-]+$`),
  );
  finishDelete?.();
  await expect(page).toHaveURL(`/projects/${project.id}/timeline`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
