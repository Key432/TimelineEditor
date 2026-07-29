import { describe, expect, it } from "vitest";

import { draftFingerprint } from "@/features/autosave/draft-store";
import { saveCloudDraftSchema } from "@/features/autosave/validation";

describe("cloud draft validation", () => {
  it("accepts Supabase timestamps with an explicit UTC offset", () => {
    expect(
      saveCloudDraftSchema.safeParse({
        value: { title: "下書き" },
        baseVersion: "2026-07-29T08:00:00+00:00",
        fingerprint: "12:abcd:ef01",
        writerId: "device-a",
        expectedVersion: 2,
      }).success,
    ).toBe(true);
  });

  it("rejects scalar payloads and invalid draft versions", () => {
    expect(
      saveCloudDraftSchema.safeParse({
        value: "not-an-object",
        baseVersion: null,
        fingerprint: "fingerprint",
        writerId: "device-a",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
  });

  it("creates a short stable fingerprint without retaining draft content", () => {
    const value = { description: "private draft text" };
    const fingerprint = draftFingerprint(value);
    expect(fingerprint).toBe(draftFingerprint(value));
    expect(fingerprint).not.toContain("private draft text");
    expect(fingerprint.length).toBeLessThanOrEqual(128);
  });
});
