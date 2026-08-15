import { expect, test } from "@playwright/test";

const helpTopics = [
  "timeline",
  "timeline-items",
  "events",
  "classification",
  "filters",
  "relationships",
  "backgrounds",
  "comparison",
  "sharing",
  "import-export",
  "keyboard",
] as const;

test("opens the static help index and Markdown reference", async ({ page }) => {
  expect((await page.request.get("/help")).status()).toBe(200);
  const helpResponse = await page.goto("/help");
  expect(helpResponse?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "ヘルプ" }),
  ).toBeVisible();
  for (const topic of helpTopics) {
    expect((await page.request.get(`/help/${topic}`)).status()).toBe(200);
  }
  await page.getByRole("link", { name: "タイムラインの表示と移動" }).click();
  await expect(page).toHaveURL(/\/help\/timeline$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "移動と拡大・縮小" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "ヘルプ一覧へ戻る" }).click();

  expect((await page.request.get("/help/markdown")).status()).toBe(200);
  await page.getByRole("link", { name: "Markdown記法" }).click();
  await expect(page).toHaveURL(/\/help\/markdown$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Markdown記法" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "コールアウト" }),
  ).toBeVisible();
  await expect(
    page.locator("code").filter({ hasText: "> [!WARNING]" }),
  ).toBeVisible();
  await expect(
    page.getByText("候補には種類、日付、親アイテムが表示されます。"),
  ).toBeVisible();
  await expect(page.getByText(/削除された参照先はリンク切れ/)).toBeVisible();
  await expect(
    page.getByText("画像・HTML・埋め込み", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ヘルプ一覧へ戻る" }),
  ).toHaveAttribute("href", "/help");
});
