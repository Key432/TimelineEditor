import { describe, expect, it } from "vitest";

import { safeRelativePath } from "@/lib/navigation";

describe("safeRelativePath", () => {
  it("keeps an application-relative path", () => {
    expect(safeRelativePath("/projects?view=timeline")).toBe(
      "/projects?view=timeline",
    );
  });

  it.each([
    ["https://attacker.example", "/projects"],
    ["//attacker.example", "/projects"],
    [String.raw`\attacker.example`, "/projects"],
    [null, "/projects"],
  ])("rejects unsafe redirect value %s", (value, expected) => {
    expect(safeRelativePath(value)).toBe(expected);
  });
});
