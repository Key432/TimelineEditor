import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const authSecret = process.env.E2E_TEST_AUTH_SECRET!;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const email = `comparison-${crypto.randomUUID()}@example.com`;
const password = `Compare-${crypto.randomUUID()}`;
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

async function createProject(
  page: import("@playwright/test").Page,
  name: string,
  itemTitle: string,
  year: number,
) {
  const response = await page.request.post("/api/projects", {
    data: {
      name,
      description: `${name}の比較データ`,
      template: "general",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1700,
        initialEndYear: 2000,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
    },
  });
  expect(response.ok()).toBe(true);
  const projectId = ((await response.json()) as { project: { id: string } })
    .project.id;
  const itemTypes = (await (
    await page.request.get(`/api/projects/${projectId}/item-types`)
  ).json()) as { itemTypes: { id: string }[] };
  expect(
    (
      await page.request.post(`/api/projects/${projectId}/items`, {
        data: {
          typeId: itemTypes.itemTypes[0]!.id,
          title: itemTitle,
          aliases: [],
          tagIds: [],
          customFields: [],
          description: null,
          sourceText: "",
          citations: [],
          externalUrl: "",
          temporalType: "point",
          colorOverride: null,
          isVisible: true,
          start: null,
          isStartApproximate: false,
          endDateStatus: null,
          end: null,
          isEndApproximate: false,
          lastConfirmed: null,
          point: { year, month: null, day: null },
          isPointApproximate: false,
        },
      })
    ).ok(),
  ).toBe(true);
  return projectId;
}

test("compares projects on one axis and restores a settings-only saved view", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/test-auth", {
        data: { email, password },
        headers: { "x-test-auth-secret": authSecret },
      })
    ).status(),
  ).toBe(204);
  const firstId = await createProject(page, "日本近代", "明治維新", 1868);
  const secondId = await createProject(page, "欧州近代", "フランス革命", 1789);

  await page.goto(
    `/compare?project=${firstId}&project=${secondId}&from=1750&to=1900`,
    { waitUntil: "networkidle" },
  );
  await expect(
    page.getByRole("heading", { name: "プロジェクト横断比較" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "日本近代" }).getByText("明治維新"),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "欧州近代" }).getByText("フランス革命"),
  ).toBeVisible();
  await expect(page.getByText("閲覧専用", { exact: true })).toBeVisible();

  await page.getByLabel("強調開始年").fill("1800");
  await page.getByLabel("強調開始年").press("Enter");
  await page.getByLabel("強調終了年").fill("1870");
  await page.getByLabel("強調終了年").press("Enter");
  await expect(page.getByLabel("1800年から1870年を強調")).toBeVisible();
  await page.getByRole("button", { name: "欧州近代を非表示" }).click();
  await expect(
    page.getByRole("button", { name: "欧州近代を表示" }),
  ).toBeVisible();

  await page.getByLabel("比較ビュー名").fill("近代比較");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("比較条件を保存しました。")).toBeVisible();
  const saved = await page.request.get("/api/comparison/saved-views");
  const payload = (await saved.json()) as {
    views: { configuration: Record<string, unknown> }[];
  };
  expect(payload.views[0]!.configuration).not.toHaveProperty("items");
  expect(payload.views[0]!.configuration).not.toHaveProperty("events");

  const detail = page
    .getByRole("region", { name: "日本近代" })
    .getByTitle(/明治維新/);
  await expect(detail).toHaveAttribute("target", "_blank");
});
