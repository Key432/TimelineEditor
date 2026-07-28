import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const email = `internal-links-e2e-${crypto.randomUUID()}@example.com`;
const password = `InternalLinks-${crypto.randomUUID()}`;
let userId = "";

if (!url || !serviceRoleKey || !authSecret) {
  throw new Error("Local Supabase E2E environment is required.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

test("selects stable internal links, keeps sidebar state, and reports broken references", async ({
  page,
}) => {
  const auth = await page.request.post("/api/test-auth", {
    data: { email, password },
    headers: { "x-test-auth-secret": authSecret },
  });
  expect(auth.status()).toBe(204);
  const projectResponse = await page.request.post("/api/projects", {
    data: {
      name: "内部リンク検証",
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
  const { data: type } = await admin
    .from("timeline_item_types")
    .select("id")
    .eq("project_id", project.id)
    .limit(1)
    .single();
  const { data: items, error } = await admin
    .from("timeline_items")
    .insert([
      {
        project_id: project.id,
        type_id: type!.id,
        title: "夏目漱石",
        aliases: ["夏目金之助"],
        temporal_type: "range",
        manual_order: 0,
        start_year: 1867,
        end_date_status: "specified",
        end_year: 1916,
      },
      {
        project_id: project.id,
        type_id: type!.id,
        title: "参照元",
        aliases: [],
        temporal_type: "range",
        manual_order: 1,
        start_year: 1900,
        end_date_status: "specified",
        end_year: 1910,
      },
    ])
    .select("id, title");
  if (error) throw error;
  const targetId = items!.find((item) => item.title === "夏目漱石")!.id;
  const sourceId = items!.find((item) => item.title === "参照元")!.id;

  await page.goto(`/projects/${project.id}/timeline`);
  await page.getByRole("button", { name: "参照元を編集" }).click();
  const form = page.getByRole("form", {
    name: "タイムラインアイテム編集",
  });
  await form.getByLabel("本文").fill("参照: [[夏目金");
  const candidates = form.getByRole("listbox", {
    name: "プロジェクト内リンク候補",
  });
  await expect(
    candidates.getByRole("option", { name: /夏目漱石/ }),
  ).toBeVisible();
  await candidates.getByRole("option", { name: /夏目漱石/ }).click();
  await expect(form.getByLabel("本文")).toHaveValue(
    new RegExp(`^参照: \\[\\[item:${targetId}\\|夏目漱石\\]\\]$`),
  );
  await form.getByRole("button", { name: "変更を保存" }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole("button", { name: "サイドパネルを折りたたむ" }).click();
  await page.getByRole("link", { name: "Chronology Studio" }).click();
  await expect(page).toHaveURL("/projects");
  await expect(
    page.getByRole("button", { name: "サイドパネルを開く" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "サイドパネルを開く" }).click();

  const renamed = await admin
    .from("timeline_items")
    .update({ title: "夏目漱石（改名後）" })
    .eq("id", targetId);
  if (renamed.error) throw renamed.error;
  await page
    .getByRole("link", { name: "内部リンク検証", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(`/projects/${project.id}/timeline`);
  await page.getByRole("button", { name: "参照元", exact: true }).click();
  const stableLink = page
    .getByRole("dialog")
    .getByRole("link", { name: "夏目漱石" });
  await expect(stableLink).toHaveAttribute(
    "href",
    `/projects/${project.id}/items/${targetId}`,
  );
  await stableLink.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "夏目漱石（改名後）" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "詳細オプション" }).click();
  await page.getByRole("menuitem", { name: "ゴミ箱へ移動" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toContainText("1件の本文から参照");
  await deleteDialog.getByRole("button", { name: "ゴミ箱へ移動" }).click();
  await expect(page).toHaveURL(`/projects/${project.id}/items/${sourceId}`);
  await page.reload();
  await expect(page.getByText("夏目漱石（リンク切れ）")).toBeVisible();
});
