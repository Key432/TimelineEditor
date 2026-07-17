import { describe, expect, it } from "vitest";

import {
  buildOAuthCallbackUrl,
  resolveOAuthOrigin,
} from "@/features/auth/origin";

describe("resolveOAuthOrigin", () => {
  const productionUrl = "https://timeline-editor-green.vercel.app";

  it.each(["http://localhost:3000", "http://127.0.0.1:3000"])(
    "uses the loopback request origin during local development: %s",
    (requestOrigin) => {
      expect(
        resolveOAuthOrigin({
          configuredAppUrl: productionUrl,
          nodeEnv: "development",
          requestOrigin,
          requestHost: null,
        }),
      ).toBe(requestOrigin);
    },
  );

  it("uses the loopback host when a Server Action has no origin", () => {
    expect(
      resolveOAuthOrigin({
        configuredAppUrl: productionUrl,
        nodeEnv: "development",
        requestHost: "localhost:3000",
        requestOrigin: null,
      }),
    ).toBe("http://localhost:3000");
  });

  it("rejects a non-loopback request origin during development", () => {
    expect(
      resolveOAuthOrigin({
        configuredAppUrl: productionUrl,
        nodeEnv: "development",
        requestHost: "attacker.example",
        requestOrigin: "https://attacker.example",
      }),
    ).toBe(productionUrl);
  });

  it("uses the configured URL in production", () => {
    expect(
      resolveOAuthOrigin({
        configuredAppUrl: productionUrl,
        nodeEnv: "production",
        requestHost: "localhost:3000",
        requestOrigin: "http://localhost:3000",
      }),
    ).toBe(productionUrl);
  });
});

describe("buildOAuthCallbackUrl", () => {
  it("matches the exact callback URL in the Supabase allow list", () => {
    expect(buildOAuthCallbackUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback",
    );
  });
});
