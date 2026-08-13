import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { navigateWithDocumentLoad } from "./helpers/navigation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const authSecret = process.env.E2E_TEST_AUTH_SECRET!;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const email = `network-e2e-${crypto.randomUUID()}@example.com`;
const password = `Network-${crypto.randomUUID()}`;
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

async function createItem(
  page: Page,
  projectId: string,
  typeId: string,
  title: string,
  year: number,
) {
  const response = await page.request.post(`/api/projects/${projectId}/items`, {
    data: {
      typeId,
      title,
      aliases: [],
      tagIds: [],
      customFields: [],
      description: "",
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
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { item: { id: string } }).item.id;
}

test("explores semantic relations with filters, highlighting, zoom, pan, and details", async ({
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
      name: "L15ネットワークテスト",
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
  const itemTypes = (
    (await (
      await page.request.get(`/api/projects/${projectId}/item-types`)
    ).json()) as {
      itemTypes: { id: string }[];
    }
  ).itemTypes;
  const sourceId = await createItem(
    page,
    projectId,
    itemTypes[0]!.id,
    "源流ノード",
    1880,
  );
  const targetId = await createItem(
    page,
    projectId,
    itemTypes[1]!.id,
    "後継ノード",
    1920,
  );
  const relationshipResponse = await page.request.post(
    `/api/projects/${projectId}/relationships`,
    {
      data: {
        sourceType: "timeline_item",
        sourceId,
        targetType: "timeline_item",
        targetId,
        relationType: "思想的継承",
        lineStyle: "double",
        sourceMarker: "arrow",
        targetMarker: "arrow",
        note: "ネットワーク探索用",
      },
    },
  );
  expect(relationshipResponse.ok()).toBe(true);
  const relationshipId = (
    (await relationshipResponse.json()) as { relationship: { id: string } }
  ).relationship.id;

  await navigateWithDocumentLoad(page, `/projects/${projectId}/timeline`);
  await page.getByRole("button", { name: "関連ネットワーク" }).click();
  const network = page.getByTestId("relationship-network");
  await expect(network).toBeVisible();
  await expect(page.getByLabel("関連ネットワークを読み込み中")).toHaveCount(0);
  const sourceNode = page.getByRole("button", { name: /源流ノード/ });
  const targetNode = page.getByRole("button", { name: /後継ノード/ });
  await expect(sourceNode).toBeVisible();
  await expect(targetNode).toBeVisible();
  await expect(sourceNode.locator("rect").first()).toHaveAttribute("rx", "0");
  await expect(sourceNode).not.toContainText("タイムライン");
  const edge = page.getByTestId(`network-edge-${relationshipId}`);
  await expect(edge.locator("path")).toHaveCount(2);
  await expect(edge.locator("path").first()).toHaveAttribute(
    "marker-start",
    "url(#network-arrow)",
  );
  await expect(edge.locator("path").first()).toHaveAttribute(
    "marker-end",
    "url(#network-arrow)",
  );

  await sourceNode.click();
  await expect(page.getByText("直接 1")).toBeVisible();
  await expect(page.getByText("2段階 0")).toBeVisible();

  const canvas = page.getByTestId("relationship-network-canvas");
  const graph = canvas.locator(":scope > g");
  const beforeZoom = await graph.getAttribute("transform");
  await canvas.dispatchEvent("wheel", {
    clientX: 400,
    clientY: 300,
    deltaY: -120,
  });
  await expect.poll(() => graph.getAttribute("transform")).not.toBe(beforeZoom);
  const beforePan = await graph.getAttribute("transform");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Network canvas is required.");
  await page.mouse.move(canvasBox.x + 8, canvasBox.y + canvasBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    canvasBox.x + 58,
    canvasBox.y + canvasBox.height / 2 + 35,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect.poll(() => graph.getAttribute("transform")).not.toBe(beforePan);

  await page.getByPlaceholder("ノード名、種別、タグを検索").fill("源流");
  await expect(sourceNode).toBeVisible();
  await expect(targetNode).toHaveCount(0);
  await page
    .getByRole("button", { name: "ネットワークのフィルターを解除" })
    .click();
  await expect(targetNode).toBeVisible();
  await sourceNode.click();
  await page.getByRole("button", { name: "詳細を開く" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${projectId}/items/${sourceId}`),
  );
});
