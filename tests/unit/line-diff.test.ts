import { describe, expect, it } from "vitest";

import { createLineDiff } from "@/features/history/line-diff";

describe("createLineDiff", () => {
  it("marks inserted, removed, and unchanged lines", () => {
    expect(createLineDiff("共通\n削除\n末尾", "共通\n追加\n末尾")).toEqual([
      { kind: "context", value: "共通" },
      { kind: "removed", value: "削除" },
      { kind: "added", value: "追加" },
      { kind: "context", value: "末尾" },
    ]);
  });

  it("keeps empty text visible as one comparable line", () => {
    expect(createLineDiff("", "本文")).toEqual([
      { kind: "removed", value: "" },
      { kind: "added", value: "本文" },
    ]);
  });
});
