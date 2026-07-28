import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInternalLinkCandidates,
  resolveInternalLinks,
} from "@/features/internal-links/api";
import { MarkdownEditor, MarkdownRenderer } from "@/features/markdown/markdown";

vi.mock("@/features/internal-links/api", () => ({
  getInternalLinkCandidates: vi.fn(),
  resolveInternalLinks: vi.fn(),
}));

function TestMarkdownEditor({
  onChange,
  projectId,
}: {
  onChange: () => void;
  projectId?: string;
}) {
  const [value, setValue] = useState("");
  const handleChange: UseFormRegisterReturn["onChange"] = async (event) => {
    onChange();
    setValue((event.target as HTMLTextAreaElement).value);
  };
  return (
    <MarkdownEditor
      id="body"
      label="本文"
      registration={{
        name: "description",
        onBlur: vi.fn(),
        onChange: handleChange,
        ref: vi.fn(),
      }}
      value={value}
      projectId={projectId}
    />
  );
}

afterEach(cleanup);

describe("MarkdownRenderer", () => {
  it("does not expose the raw internal-link token while resolving it", async () => {
    let finishResolution:
      | ((targets: Awaited<ReturnType<typeof resolveInternalLinks>>) => void)
      | undefined;
    vi.mocked(resolveInternalLinks).mockReturnValueOnce(
      new Promise((resolve) => {
        finishResolution = resolve;
      }),
    );
    render(
      <MarkdownRenderer
        projectId="22222222-2222-4222-8222-222222222222"
        value={[
          "# 見出し",
          "",
          "[[item:11111111-1111-4111-8111-111111111111|参照先]]",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("status", { name: "本文を読み込み中" }),
    ).toBeVisible();
    expect(screen.queryByText(/\[\[item:/)).not.toBeInTheDocument();

    await act(async () => {
      finishResolution?.([
        {
          entityType: "item",
          entityId: "11111111-1111-4111-8111-111111111111",
          title: "参照先",
        },
      ]);
    });
    expect(await screen.findByRole("link", { name: "参照先" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "見出し" })).toBeVisible();
  });

  it("renders supported Markdown and GitHub-style callouts", () => {
    render(
      <MarkdownRenderer
        value={[
          "# 見出し",
          "",
          "**太字**と*斜体*と~~取消~~と`code`",
          "",
          "- 箇条書き",
          "",
          "1. 番号付き",
          "",
          "> 引用本文",
          "",
          "---",
          "",
          "```ts",
          "const year = 1867;",
          "```",
          "",
          "[外部資料](https://example.com/source)",
          "",
          "| 名前 | 年 |",
          "| --- | ---: |",
          "| 漱石 | 1867 |",
          "",
          "> [!WARNING]",
          "> 要確認です。",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("heading", { name: "見出し" })).toBeVisible();
    expect(screen.getByText("太字").tagName).toBe("STRONG");
    expect(screen.getByText("斜体").tagName).toBe("EM");
    expect(screen.getByText("取消").tagName).toBe("DEL");
    expect(screen.getByText("箇条書き").closest("ul")).not.toBeNull();
    expect(screen.getByText("番号付き").closest("ol")).not.toBeNull();
    expect(screen.getByText("引用本文").closest("blockquote")).not.toBeNull();
    expect(
      screen.getByText("const year = 1867;").closest("pre"),
    ).not.toBeNull();
    expect(screen.getByRole("link", { name: "外部資料" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(document.querySelector("hr")).not.toBeNull();
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByRole("note", { name: "警告" })).toHaveTextContent(
      "要確認です。",
    );
    expect(screen.getByRole("note", { name: "警告" })).not.toHaveTextContent(
      "[!WARNING]",
    );
  });

  it.each([
    ["NOTE", "注記"],
    ["TIP", "ヒント"],
    ["IMPORTANT", "重要"],
    ["WARNING", "警告"],
    ["CAUTION", "注意"],
  ])("renders the %s callout", (type, label) => {
    render(<MarkdownRenderer value={`> [!${type}]\n> 本文`} />);
    expect(screen.getByRole("note", { name: label })).toHaveTextContent("本文");
  });

  it("drops raw HTML, images, embeds, and unsafe URLs", () => {
    const { container } = render(
      <MarkdownRenderer
        value={[
          '<script>alert("xss")</script>',
          '<iframe src="https://example.com"></iframe>',
          "![画像](https://example.com/image.png)",
          "[危険](javascript:alert(1))",
          "[data](data:text/html,bad)",
          "[安全](https://example.com/path)",
        ].join("\n\n")}
      />,
    );

    expect(container.querySelector("script, iframe, img")).toBeNull();
    expect(screen.getByText("危険").closest("a")).toBeNull();
    expect(screen.getByText("data").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "安全" })).toHaveAttribute(
      "href",
      "https://example.com/path",
    );
    expect(screen.getByRole("link", { name: "安全" })).toHaveAttribute(
      "rel",
      "noreferrer noopener",
    );
  });

  it("links an attached citation key without changing unknown keys", () => {
    render(
      <MarkdownRenderer
        projectId="22222222-2222-4222-8222-222222222222"
        value="参照 [@known2024] と [@unknown]"
        citations={[
          {
            sourceId: "11111111-1111-4111-8111-111111111111",
            source: {
              id: "11111111-1111-4111-8111-111111111111",
              projectId: "22222222-2222-4222-8222-222222222222",
              title: "資料",
              authors: [],
              publisher: null,
              publicationYear: null,
              isbn: null,
              url: null,
              accessedOn: null,
              citationKey: "known2024",
              notes: null,
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
            pages: null,
            chapter: null,
            quote: null,
            notes: null,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "known2024" })).toHaveAttribute(
      "href",
      "/projects/22222222-2222-4222-8222-222222222222/sources#source-11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText(/\[@unknown\]/)).toBeVisible();
  });
});

describe("MarkdownEditor", () => {
  it("switches between matching edit and preview fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestMarkdownEditor onChange={onChange} />);

    const editor = screen.getByRole("textbox", { name: "本文" });
    expect(editor).toHaveClass(
      "border-0",
      "bg-transparent",
      "px-0",
      "py-2",
      "text-base",
      "md:text-sm",
      "shadow-none",
      "focus-visible:ring-0",
    );
    expect(editor).not.toHaveClass("border");
    expect(screen.queryByRole("button", { name: "分割" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Markdownプレビュー" }),
    ).toBeNull();

    await user.type(editor, "**即時**");
    expect(onChange).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "プレビュー" }));
    expect(screen.queryByRole("textbox", { name: "本文" })).toBeNull();
    const preview = screen.getByRole("region", { name: "Markdownプレビュー" });
    expect(preview).toHaveClass(
      "border-0",
      "bg-transparent",
      "px-0",
      "py-2",
      "text-base",
      "md:text-sm",
      "shadow-none",
    );
    expect(preview).not.toHaveClass("border");
    expect(screen.getByText("即時").tagName).toBe("STRONG");
    expect(
      screen.queryByText(/HTML・画像・埋め込みは表示されません/),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Markdown記法ヘルプ" }),
    ).toHaveAttribute("href", "/help/markdown");
    expect(
      screen.getByRole("link", { name: "Markdown記法ヘルプ" }),
    ).toHaveAttribute("target", "_blank");
    expect(
      screen.getByRole("link", { name: "Markdown記法ヘルプ" }),
    ).toHaveAttribute("rel", "noreferrer noopener");

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByRole("textbox", { name: "本文" })).toBeVisible();
  });

  it("inserts the selected candidate into the controlled textarea", async () => {
    vi.mocked(getInternalLinkCandidates).mockResolvedValue([
      {
        entityType: "item",
        entityId: "11111111-1111-4111-8111-111111111111",
        title: "夏目漱石",
        aliases: ["夏目金之助"],
        kindLabel: "人物",
        dateLabel: "1867",
        parentTitle: null,
      },
    ]);
    const user = userEvent.setup();
    render(<TestMarkdownEditor onChange={vi.fn()} projectId="project-1" />);

    const editor = screen.getByRole("textbox", { name: "本文" });
    fireEvent.change(editor, { target: { value: "参照: [[夏目金" } });
    await user.click(await screen.findByRole("option", { name: /夏目漱石/ }));

    expect(editor).toHaveValue(
      "参照: [[item:11111111-1111-4111-8111-111111111111|夏目漱石]]",
    );
  });
});
