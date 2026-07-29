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
const email = `classification-e2e-${crypto.randomUUID()}@example.com`;
const password = `Classification-${crypto.randomUUID()}`;
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

test("customizes an event marker visually and assigns Notion-style tags and custom fields", async ({
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
      name: "L9分類テスト",
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
  const projectId = (
    (await projectResponse.json()) as { project: { id: string } }
  ).project.id;
  await page.request.post(`/api/projects/${projectId}/classification`, {
    data: {
      kind: "tag",
      values: { name: "分類：長編", color: "#FDE68A", description: "長編作品" },
    },
  });
  await page.request.post(`/api/projects/${projectId}/classification`, {
    data: {
      kind: "eventType",
      values: {
        name: "出版",
        color: "#123456",
        markerShape: "diamond",
        description: "刊行",
      },
    },
  });
  await page.request.post(`/api/projects/${projectId}/classification`, {
    data: {
      kind: "customField",
      values: {
        entityType: "timeline_event",
        scope: "project",
        targetTypeId: null,
        name: "初版部数",
        fieldType: "number",
        isRequired: true,
        options: [],
        description: null,
      },
    },
  });
  const classification = (await (
    await page.request.get(`/api/projects/${projectId}/classification`)
  ).json()) as {
    tags: { id: string }[];
    eventTypes: { id: string }[];
    customFields: { id: string }[];
  };
  const itemTypes = (
    (await (
      await page.request.get(`/api/projects/${projectId}/item-types`)
    ).json()) as { itemTypes: { id: string }[] }
  ).itemTypes;
  const itemResponse = await page.request.post(
    `/api/projects/${projectId}/items`,
    {
      data: {
        typeId: itemTypes[0]!.id,
        title: "作家",
        aliases: [],
        tagIds: [],
        customFields: [],
        description: "",
        sourceText: "",
        citations: [],
        externalUrl: "",
        temporalType: "range",
        colorOverride: null,
        isVisible: true,
        start: { year: 1900, month: null, day: null },
        isStartApproximate: false,
        endDateStatus: "specified",
        end: { year: 1950, month: null, day: null },
        isEndApproximate: false,
        lastConfirmed: null,
        point: null,
        isPointApproximate: false,
      },
    },
  );
  const itemId = ((await itemResponse.json()) as { item: { id: string } }).item
    .id;
  const eventResponse = await page.request.post(
    `/api/projects/${projectId}/events`,
    {
      data: {
        timelineItemId: itemId,
        eventTypeId: classification.eventTypes[0]!.id,
        tagIds: [classification.tags[0]!.id],
        customFields: [
          { fieldId: classification.customFields[0]!.id, value: 1000 },
        ],
        title: "代表作刊行",
        aliases: [],
        date: { year: 1910, month: null, day: null },
        isApproximate: false,
        description: "",
        sourceText: "",
        citations: [],
        externalUrl: "",
      },
    },
  );
  expect(eventResponse.ok()).toBe(true);
  const eventId = ((await eventResponse.json()) as { event: { id: string } })
    .event.id;

  await page.goto(`/projects/${projectId}/timeline`);
  const marker = page.getByRole("button", {
    name: /イベントアイテム 代表作刊行/,
  });
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(marker).toHaveCSS(
    "clip-path",
    "polygon(50% 0px, 100% 50%, 50% 100%, 0px 50%)",
  );

  await page.goto(`/projects/${projectId}/events/${eventId}`);
  await expect(page.getByText("分類：長編", { exact: true })).toBeVisible();
  await expect(page.getByText("出版", { exact: true })).toBeVisible();
  await expect(page.getByText("初版部数", { exact: true })).toBeVisible();
  await expect(page.getByText("1000", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "編集" }).click();
  const form = page.getByRole("form", { name: "イベントアイテム編集" });
  await expect(form.getByText("分類：長編", { exact: true })).toBeVisible();
  await form.getByLabel("タグを検索または作成").click();
  await expect(
    form.getByRole("button", { name: "分類：長編の設定変更" }),
  ).toBeVisible();
  await form.getByRole("button", { name: "閉じる" }).click();
  await form.getByRole("button", { name: "出版" }).click();
  await form.getByRole("button", { name: "出版の設定変更" }).click();
  await expect(
    form.getByRole("button", { name: "diamond形状" }),
  ).toHaveAttribute("aria-pressed", "true");
});
