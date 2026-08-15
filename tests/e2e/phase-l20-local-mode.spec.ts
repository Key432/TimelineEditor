import { expect, test } from "@playwright/test";

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
