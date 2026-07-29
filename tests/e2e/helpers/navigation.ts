import { expect, type Page } from "@playwright/test";

export async function navigateWithDocumentLoad(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("NS_BINDING_ABORTED")
      ) {
        throw error;
      }
    }
    if (new URL(page.url()).pathname === url) {
      await page.waitForLoadState("networkidle");
      if (url.endsWith("/timeline")) {
        await expect(page.getByTestId("timeline-workspace")).toHaveAttribute(
          "data-client-ready",
          "true",
        );
      }
      return;
    }
  }
  await expect.poll(() => new URL(page.url()).pathname).toBe(url);
}
