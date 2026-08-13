import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { navigateWithDocumentLoad } from "./helpers/navigation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const authSecret = process.env.E2E_TEST_AUTH_SECRET!;
if (!url || !serviceRoleKey || !authSecret)
  throw new Error("Local Supabase E2E environment is required.");
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const email = `visual-export-${crypto.randomUUID()}@example.com`;
const password = `Export-${crypto.randomUUID()}`;
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

test("exports all or specified timeline data as SVG, PNG, and configured PDF", async ({
  page,
}, testInfo) => {
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
      name: "日本文学史出力",
      description: "日本語を含むPhase 17出力確認",
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
  expect(projectResponse.ok()).toBe(true);
  const projectId = (
    (await projectResponse.json()) as { project: { id: string } }
  ).project.id;
  const itemTypes = (
    (await (
      await page.request.get(`/api/projects/${projectId}/item-types`)
    ).json()) as { itemTypes: { id: string }[] }
  ).itemTypes;
  expect(
    (
      await page.request.post(`/api/projects/${projectId}/items`, {
        data: {
          typeId: itemTypes[0]!.id,
          title: "夏目漱石",
          aliases: [],
          tagIds: [],
          customFields: [],
          description: "吾輩は猫である",
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
          point: { year: 1867, month: null, day: null },
          isPointApproximate: false,
        },
      })
    ).ok(),
  ).toBe(true);

  await navigateWithDocumentLoad(page, `/projects/${projectId}/timeline`);
  await page.getByRole("button", { name: "管理メニュー" }).click();
  await page
    .getByRole("menuitem", { name: "インポート／エクスポート" })
    .click();
  const panelBox = await page
    .getByRole("dialog", { name: "インポート／エクスポート" })
    .boundingBox();
  expect(panelBox?.width).toBeGreaterThan(800);
  await expect(page.getByText("タイムラインを画像・PDFで出力")).toBeVisible();
  const svgButton = page.getByRole("button", { name: "SVGを保存" });
  await expect(svgButton).toBeEnabled();
  await page.getByLabel("出力する表示").selectOption("compact");
  await page.getByLabel("出力範囲").selectOption("custom");
  await page.getByLabel("開始年").fill("1850");
  await page.getByLabel("終了年").fill("1900");

  const svgDownloadPromise = page.waitForEvent("download");
  await svgButton.click();
  const svgDownload = await svgDownloadPromise;
  expect(svgDownload.suggestedFilename()).toMatch(/_compact\.svg$/);
  const svgPath = await svgDownload.path();
  expect(svgPath).not.toBeNull();
  const svg = await readFile(svgPath!, "utf8");
  expect(svg).toContain("日本文学史出力");
  expect(svg).toContain("夏目漱石");

  const pngDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNGを保存" }).click();
  const pngPath = await (await pngDownloadPromise).path();
  expect(pngPath).not.toBeNull();
  expect((await readFile(pngPath!)).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  await page
    .getByText("用紙サイズ")
    .locator("..")
    .locator("select")
    .selectOption("a3");
  await page
    .getByText("向き")
    .locator("..")
    .locator("select")
    .selectOption("portrait");
  await page
    .getByText("縮尺・分割")
    .locator("..")
    .locator("select")
    .selectOption("fit-height");
  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDFを保存" }).click();
  const pdfDownload = await pdfDownloadPromise;
  const pdfPath = testInfo.outputPath("phase-l17-japanese.pdf");
  await pdfDownload.saveAs(pdfPath);
  expect((await readFile(pdfPath)).subarray(0, 5).toString("ascii")).toBe(
    "%PDF-",
  );
});
