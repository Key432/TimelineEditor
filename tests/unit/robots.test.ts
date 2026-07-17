import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import robots from "@/app/robots";

describe("noindex configuration", () => {
  it("disallows all crawlers", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    });
  });

  it("adds the X-Robots-Tag header to every route", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers?.[0]?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
    });
  });
});
