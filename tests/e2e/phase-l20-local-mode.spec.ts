import { expect, test } from "@playwright/test";

async function createGuestProject(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();
  await page.getByLabel("プロジェクト名").fill("ゲスト文学史");
  await page.getByLabel("テンプレート").selectOption("literature");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ゲスト文学史" }),
  ).toBeVisible();
}

test("creates and restores a guest timeline from the root page", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "ログイン" })).toHaveAttribute(
    "href",
    "/login",
  );
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();
  await page.getByLabel("プロジェクト名").fill("ゲスト文学史");
  await page.getByLabel("テンプレート").selectOption("literature");
  await page.getByRole("button", { name: "作成", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "ゲスト文学史" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "アイテムを追加" }).click();
  const itemDialog = page.getByRole("dialog", {
    name: "タイムラインアイテムを追加",
  });
  await itemDialog.getByLabel("名称").fill("夏目漱石");
  await itemDialog.getByLabel("開始年").fill("1867");
  await itemDialog.getByLabel("終了年").fill("1916");
  await itemDialog.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("夏目漱石").first()).toBeVisible();
  await expect(page.getByText(/保存済み/)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ゲスト文学史" }),
  ).toBeVisible();
  await page.getByLabel("ローカル全文検索").fill("漱石");
  await expect(page.getByText("タイムライン：夏目漱石")).toBeVisible();
});

test("renders local editors without duplicate React keys", async ({ page }) => {
  const duplicateKeyWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("same key")) {
      duplicateKeyWarnings.push(message.text());
    }
  });

  await createGuestProject(page);
  await page.getByRole("button", { name: "アイテムを追加" }).click();
  await page.getByRole("button", { name: "閉じる" }).click();

  expect(duplicateKeyWarnings).toEqual([]);
});

test("allows the timeline field to scroll vertically on a short viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 560 });
  await createGuestProject(page);

  const main = page.locator("main");
  await expect
    .poll(() =>
      main.evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        scrollable: element.scrollHeight > element.clientHeight,
      })),
    )
    .toEqual({ overflowY: "auto", scrollable: true });
});

test("accepts month and day precision for local items and events", async ({
  page,
}) => {
  await createGuestProject(page);
  await page.getByRole("button", { name: "アイテムを追加" }).click();
  const itemDialog = page.getByRole("dialog", {
    name: "タイムラインアイテムを追加",
  });
  await itemDialog.getByLabel("名称").fill("年月日項目");
  await itemDialog.getByLabel("開始日の精度").selectOption("day");
  await itemDialog.getByLabel("開始月").fill("4");
  await itemDialog.getByLabel("開始日", { exact: true }).fill("5");
  await itemDialog.getByLabel("終了日の精度").selectOption("month");
  await itemDialog.getByLabel("終了月").fill("6");
  await itemDialog.getByRole("button", { name: "保存" }).click();

  await page.getByRole("button", { name: "イベント" }).click();
  const eventDialog = page.getByRole("dialog", { name: "イベントを追加" });
  await eventDialog.getByLabel("年月日項目").check();
  await eventDialog.getByLabel("日付の精度").selectOption("day");
  await eventDialog.getByLabel("月", { exact: true }).fill("7");
  await eventDialog.getByLabel("日", { exact: true }).fill("8");
  await eventDialog.getByLabel("イベント名").fill("年月日イベント");
  await eventDialog.getByRole("button", { name: "保存" }).click();

  await page.reload();
  await page.getByLabel("ローカル全文検索").fill("年月日項目");
  await page.getByText("タイムライン：年月日項目").click();
  await expect(page.getByLabel("開始日の精度")).toHaveValue("day");
  await expect(page.getByLabel("開始月")).toHaveValue("4");
  await expect(page.getByLabel("開始日", { exact: true })).toHaveValue("5");
});

test("explains remote-only features in a dismissible scrollable callout", async ({
  page,
}) => {
  await page.goto("/");
  const callout = page.getByRole("note", { name: "ログインするとできること" });
  await expect(callout).toBeVisible();
  await expect(callout.getByText("クラウド保存と端末間同期")).toBeVisible();
  await expect(callout.getByText("公開・共有URL")).toBeVisible();
  await expect(callout.locator("[data-callout-scroll]")).toHaveCSS(
    "overflow-y",
    "auto",
  );
  await callout.getByRole("button", { name: "案内を閉じる" }).click();
  await expect(callout).toBeHidden();
  await page.reload();
  await expect(callout).toBeHidden();
});

test("offers an explicit login route without creating a Supabase guest", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Googleでログイン" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ログインせず年表を編集" }),
  ).toHaveAttribute("href", "/");
});
