import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, requestJson } from "@/lib/api-client";

afterEach(() => vi.restoreAllMocks());

describe("requestJson", () => {
  it("returns JSON and supports empty success responses", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(Response.json({ value: 42 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(requestJson<{ value: number }>("/value")).resolves.toEqual({
      value: 42,
    });
    await expect(
      requestJson<void>("/value", { method: "DELETE" }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("preserves the API message and HTTP status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json(
        { error: { message: "入力を確認してください。" } },
        { status: 422 },
      ),
    );

    const error = await requestJson("/value").catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      message: "入力を確認してください。",
      status: 422,
    });
  });

  it("uses the caller fallback when an error response is not JSON", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("not-json", { status: 500 }),
    );

    await expect(
      requestJson("/value", undefined, "読み込みに失敗しました。"),
    ).rejects.toMatchObject({
      message: "読み込みに失敗しました。",
      status: 500,
    });
  });
});
