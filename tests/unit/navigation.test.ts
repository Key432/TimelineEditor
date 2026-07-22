import { describe, expect, it } from "vitest";

import {
  safeRelativePath,
  safeSearchReturnPath,
  withSearchReturn,
} from "@/lib/navigation";

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

describe("search return navigation", () => {
  it("only accepts a local search results path", () => {
    expect(safeSearchReturnPath("/search?q=源氏")).toBe("/search?q=源氏");
    expect(safeSearchReturnPath("/projects/private")).toBeNull();
    expect(safeSearchReturnPath("//attacker.example/search")).toBeNull();
  });

  it("adds an encoded return path to a detail URL", () => {
    expect(withSearchReturn("/projects/1/items/2", "/search?q=a b")).toBe(
      "/projects/1/items/2?returnTo=%2Fsearch%3Fq%3Da%20b",
    );
  });
});
