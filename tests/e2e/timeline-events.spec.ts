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
      name: "子イベント検証",
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
        summary: "",
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
  await page.getByRole("button", { name: "親人物を編集" }).click();
  await page.getByRole("button", { name: "子イベントを追加" }).click();
  const sideForm = page.getByRole("form", { name: "子イベント作成" });
  await sideForm.getByLabel("タイトル").fill("初期作品");
  await sideForm.getByLabel("イベント年").fill("1903");
  await sideForm.getByRole("button", { name: "子イベントを作成" }).click();
  await expect(page.getByText("初期作品", { exact: true })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  await expect(
    page.getByRole("button", { name: /子イベント 初期作品/ }),
  ).toBeVisible();

  const surface = page
    .getByTestId(`timeline-row-${item.id}`)
    .locator("[data-timeline-pan-surface='true']");
  const box = await surface.boundingBox();
  if (!box) throw new Error("Timeline row is required.");
  await surface.dblclick({
    position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) },
  });
  const createForm = page.getByRole("form", { name: "子イベント作成" });
  await expect(createForm).toBeVisible();
  await expect(createForm.getByLabel("親タイムライン項目")).toHaveValue(
    item.id,
  );
  await createForm.getByLabel("タイトル").fill("代表作刊行");
  await createForm.getByLabel("イベント年").fill("1905");
  await createForm.getByLabel("イベント月").fill("1");
  await createForm.getByLabel("イベント日").fill("15");
  await expect(page.getByLabel(/仮マーカー/)).toBeVisible();
  await createForm.getByRole("button", { name: "子イベントを作成" }).click();

  const marker = page.getByRole("button", { name: /子イベント 代表作刊行/ });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project.id}/events/[0-9a-f-]+$`),
  );
  await expect(page.getByRole("dialog")).toContainText("代表作刊行");
  await expect(page.getByText("親人物", { exact: true })).toBeVisible();
  const eventId = page.url().split("/").at(-1)!;

  await page.goBack();
  await expect(page).toHaveURL(`/projects/${project.id}/timeline`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await marker.dblclick();
  await expect(page).toHaveURL(
    `/projects/${project.id}/events/${eventId}/edit`,
  );
  await expect(
    page.getByRole("dialog").getByRole("form", { name: "子イベント編集" }),
  ).toBeVisible();

  await page.goto(`/projects/${project.id}/events/${eventId}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "代表作刊行" })).toBeVisible();
});
