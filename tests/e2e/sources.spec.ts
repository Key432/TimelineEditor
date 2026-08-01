import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { navigateWithDocumentLoad } from "./helpers/navigation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `sources-e2e-${crypto.randomUUID()}@example.com`;
const password = `Sources-${crypto.randomUUID()}`;
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

test("keeps free-text sources while optionally attaching a reusable detailed source", async ({
  page,
}) => {
  test.slow();
  const auth = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "出典テスト",
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
  const { project } = (await projectResponse.json()) as {
    project: { id: string };
  };

  await page.goto(`/projects/${project.id}/timeline`);
  await expect(
    page.locator("header").getByRole("button", { name: "管理メニュー" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "管理メニュー" }).click();
  const managementItems = await page.getByRole("menuitem").allTextContents();
  expect(managementItems.map((label) => label.trim())).toEqual([
    "データ品質・重複統合",
    "種別・タグ・カスタムフィールド",
    "出典・参考文献",
    "年代背景",
    "プロジェクト設定・共有",
    "インポート／エクスポート",
  ]);
  await page.getByRole("menuitem", { name: "出典・参考文献" }).click();
  const sourcePanel = page.getByRole("dialog");
  await expect(
    sourcePanel.getByRole("heading", { name: "出典・参考文献" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      sourcePanel.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(800);
  await expect
    .poll(async () =>
      (await sourcePanel.locator("section h2").allTextContents()).map(
        (heading) => heading.trim(),
      ),
    )
    .toEqual(["資料マスタ", "新しい資料", "出典未設定の項目"]);
  await sourcePanel.getByRole("button", { name: "閉じる" }).click();

  await navigateWithDocumentLoad(page, "/projects");
  const projectCard = page.locator("[data-slot='card']").filter({
    has: page.getByRole("link", {
      name: "出典テストのタイムラインを開く",
    }),
  });
  const projectActions = await projectCard.getByRole("link").allTextContents();
  expect(projectActions.map((label) => label.trim()).slice(-2)).toEqual([
    "出典・参考文献",
    "設定を開く",
  ]);
  await expect(
    projectCard.getByRole("link", { name: "出典テストの出典・参考文献を開く" }),
  ).toHaveAttribute("href", `/projects/${project.id}/sources`);

  await navigateWithDocumentLoad(page, `/projects/${project.id}/settings`);
  await expect(
    page
      .getByRole("heading", { name: "ゴミ箱", exact: true })
      .locator("..")
      .locator(".."),
  ).not.toHaveClass(/border-t|pt-6/);
  await expect(
    page.getByRole("link", { name: "出典・参考文献を管理" }),
  ).toHaveCount(0);

  await navigateWithDocumentLoad(page, `/projects/${project.id}/sources`);
  await expect(
    page.getByRole("link", { name: "タイムラインへ" }),
  ).toHaveAttribute("href", `/projects/${project.id}/timeline`);
  await expect
    .poll(async () =>
      (await page.locator("main h2").allTextContents()).map((heading) =>
        heading.trim(),
      ),
    )
    .toEqual(["資料マスタ", "新しい資料", "出典未設定の項目"]);
  await page.getByLabel("資料名").fill("日本近代文学史");
  await page.getByLabel("著者（1行に1名）").fill("山田 太郎");
  await page.getByLabel("刊行年").fill("2024");
  await page.getByLabel("引用キー").fill("yamada2024");
  await page.getByRole("button", { name: "資料を登録" }).click();
  await expect(page.getByRole("heading", { name: "資料マスタ" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "資料名" })).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: "資料名" }).first(),
  ).toHaveValue("");
  const masterDetails = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "資料マスタ" }) })
    .locator("details");
  await expect(masterDetails).not.toHaveAttribute("open");
  await expect(masterDetails.locator("summary")).toContainText(
    "日本近代文学史",
  );
  await expect(masterDetails.locator("summary")).toContainText("山田 太郎");
  await masterDetails.locator("summary").click();
  await expect(page.getByRole("textbox", { name: "資料名" })).toHaveCount(2);
  await expect(
    page.getByRole("textbox", { name: "資料名" }).first(),
  ).toHaveValue("日本近代文学史");

  const sourcesResponse = await page.request.get(
    `/api/projects/${project.id}/sources`,
  );
  const { sources } = (await sourcesResponse.json()) as {
    sources: { id: string }[];
  };
  const typesResponse = await page.request.get(
    `/api/projects/${project.id}/item-types`,
  );
  const { itemTypes } = (await typesResponse.json()) as {
    itemTypes: { id: string }[];
  };
  const itemResponse = await page.request.post(
    `/api/projects/${project.id}/items`,
    {
      data: {
        typeId: itemTypes[0]!.id,
        title: "夏目漱石",
        aliases: [],
        description: "代表的研究 [@yamada2024]",
        sourceText: "人物事典 第一巻（従来形式）",
        citations: [
          {
            sourceId: sources[0]!.id,
            pages: "123-128",
            chapter: "第3章",
            quote: "引用箇所の抜粋",
            notes: "",
          },
        ],
        externalUrl: "",
        temporalType: "range",
        colorOverride: null,
        isVisible: true,
        start: { year: 1867, month: null, day: null },
        isStartApproximate: false,
        endDateStatus: "specified",
        end: { year: 1916, month: null, day: null },
        isEndApproximate: false,
        lastConfirmed: null,
        point: null,
        isPointApproximate: false,
      },
    },
  );
  expect(itemResponse.ok()).toBe(true);
  const { item } = (await itemResponse.json()) as { item: { id: string } };

  const itemUrl = `/projects/${project.id}/items/${item.id}`;
  await navigateWithDocumentLoad(page, itemUrl);
  await expect(page.getByText("人物事典 第一巻（従来形式）")).toBeVisible();
  await expect(page.getByText("日本近代文学史")).toBeVisible();
  const citationDetails = page.locator(`#source-${sources[0]!.id} details`);
  await expect(citationDetails).not.toHaveAttribute("open");
  await citationDetails.locator("summary").click();
  await expect(page.getByText("第3章", { exact: true })).toBeVisible();
  await expect(page.getByText("123-128", { exact: true })).toBeVisible();
  await expect(page.getByText("引用箇所の抜粋")).toBeVisible();
  await expect(page.getByRole("link", { name: "yamada2024" })).toBeVisible();

  await navigateWithDocumentLoad(page, `/projects/${project.id}/timeline`);
  await expect(async () => {
    await page.getByLabel(/夏目漱石.*期間型バー/).click();
    await expect(page).toHaveURL(`/projects/${project.id}/items/${item.id}`, {
      timeout: 2_000,
    });
  }).toPass({ timeout: 15_000 });
  let detailDialog = page.getByRole("dialog");
  await expect(detailDialog).toBeVisible({ timeout: 15_000 });
  await detailDialog.getByRole("link", { name: "yamada2024" }).click();
  await expect(page).toHaveURL(
    `/projects/${project.id}/sources#source-${sources[0]!.id}`,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await navigateWithDocumentLoad(page, `/projects/${project.id}/timeline`);
  await expect(async () => {
    await page.getByLabel(/夏目漱石.*期間型バー/).click();
    await expect(page).toHaveURL(`/projects/${project.id}/items/${item.id}`, {
      timeout: 2_000,
    });
  }).toPass({ timeout: 15_000 });
  detailDialog = page.getByRole("dialog");
  await expect(detailDialog).toBeVisible({ timeout: 15_000 });
  await detailDialog.locator(`#source-${sources[0]!.id} summary`).click();
  await detailDialog.getByRole("link", { name: "資料マスタで確認" }).click();
  await expect(page).toHaveURL(
    `/projects/${project.id}/sources#source-${sources[0]!.id}`,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "資料マスタ" })).toBeVisible();

  await navigateWithDocumentLoad(
    page,
    `/projects/${project.id}/items/${item.id}`,
  );
  await page.getByRole("button", { name: "編集" }).click();
  const form = page.getByRole("form", { name: "タイムラインアイテム編集" });
  await expect(form.getByRole("tab", { name: "自由記述" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(form.getByLabel("出典・参考文献")).toHaveValue(
    "人物事典 第一巻（従来形式）",
  );
  await form.getByRole("tab", { name: "詳細登録（1）" }).click();
  await expect(form.getByText("日本近代文学史")).toBeVisible();
  await expect(form.getByLabel("ページ")).toHaveValue("123-128");
});
