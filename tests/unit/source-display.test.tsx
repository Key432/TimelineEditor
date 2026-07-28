import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SourceDisplay } from "@/features/sources/source-display";

afterEach(cleanup);

describe("SourceDisplay", () => {
  it("keeps a citation summary collapsed until its details are requested", async () => {
    const user = userEvent.setup();
    render(
      <SourceDisplay
        projectId="22222222-2222-4222-8222-222222222222"
        sourceText="従来形式の出典"
        citations={[
          {
            sourceId: "11111111-1111-4111-8111-111111111111",
            source: {
              id: "11111111-1111-4111-8111-111111111111",
              projectId: "22222222-2222-4222-8222-222222222222",
              title: "日本近代文学史",
              authors: ["山田 太郎"],
              publisher: "歴史出版",
              publicationYear: 2024,
              isbn: "978-4-0000-0000-0",
              url: "https://example.com/source",
              accessedOn: "2026-07-29",
              citationKey: "yamada2024",
              notes: "資料全体の注記",
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
            chapter: "第3章",
            pages: "123-128",
            quote: "引用箇所の抜粋",
            notes: "引用箇所の注記",
          },
        ]}
      />,
    );

    expect(screen.getByText("従来形式の出典")).toBeVisible();
    const details = screen.getByText(/日本近代文学史/).closest("details");
    expect(details).not.toHaveAttribute("open");

    await user.click(screen.getByText(/日本近代文学史/));

    expect(details).toHaveAttribute("open");
    expect(screen.getByText("歴史出版")).toBeVisible();
    expect(screen.getByText("第3章")).toBeVisible();
    expect(screen.getByText("123-128")).toBeVisible();
    expect(screen.getByText("引用箇所の抜粋")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "資料マスタで確認" }),
    ).toHaveAttribute(
      "href",
      "/projects/22222222-2222-4222-8222-222222222222/sources#source-11111111-1111-4111-8111-111111111111",
    );
  });
});
