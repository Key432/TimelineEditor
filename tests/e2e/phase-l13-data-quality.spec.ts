import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local E2E environment is required.");

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test("Phase L13 diagnoses duplicates and merges them with keyboard-accessible Undo", async ({
  page,
}) => {
  test.slow();
  const email = `l13-e2e-${crypto.randomUUID()}@example.com`;
  const password = `L13-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;

  const auth = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  await page.goto("/projects/new");
  await page.getByLabel("プロジェクト名").fill("L13品質テスト");
  await page.getByRole("button", { name: "プロジェクトを作成" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/timeline$/);
  const projectId = page.url().match(/\/projects\/([^/]+)\/timeline/)?.[1];
  if (!projectId) throw new Error("Project ID is required.");
  const { data: type, error: typeError } = await admin
    .from("timeline_item_types")
    .select("id")
    .eq("project_id", projectId)
    .limit(1)
    .single();
  if (typeError) throw typeError;
  const { error: itemError } = await admin.from("timeline_items").insert([
    {
      project_id: projectId,
      type_id: type.id,
      title: "徳川 家康",
      aliases: [],
      temporal_type: "range",
      manual_order: 0,
      start_year: 1543,
      end_date_status: "specified",
      end_year: 1616,
    },
    {
      project_id: projectId,
      type_id: type.id,
      title: "徳川家康",
      aliases: ["家康"],
      temporal_type: "range",
      manual_order: 1,
      start_year: 1543,
      end_date_status: "specified",
      end_year: 1616,
    },
  ]);
  if (itemError) throw itemError;
  await page.reload();

  const management = page.getByRole("button", { name: "管理メニュー" });
  await management.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "データ品質・重複統合" }).click();
  const panel = page.getByRole("dialog", { name: "データ品質・重複統合" });
  await expect(panel.getByText("重複候補")).toBeVisible();
  await expect(
    panel.getByText(/徳川 家康 \/ 徳川家康|徳川家康 \/ 徳川 家康/),
  ).toBeVisible();
  await panel.getByRole("button", { name: "統合を確認" }).click();

  const preview = page.getByRole("dialog", {
    name: "重複データの統合プレビュー",
  });
  await expect(preview.getByText("統合される情報")).toBeVisible();
  await preview.getByLabel("徳川 家康").check();
  await preview.getByRole("button", { name: "この内容で統合" }).click();
  await expect(panel.getByText("統合が完了しました。")).toBeVisible();
  await expect(panel.getByText("重複候補はありません。")).toBeVisible();
  await panel.getByRole("button", { name: "統合をUndo" }).click();
  await expect(panel.getByRole("button", { name: "統合を確認" })).toBeVisible();
});
