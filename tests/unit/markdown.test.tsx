import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownEditor, MarkdownRenderer } from "@/features/markdown/markdown";

function TestMarkdownEditor({ onChange }: { onChange: () => void }) {
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
    />
  );
}

afterEach(cleanup);

describe("MarkdownRenderer", () => {
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
});

describe("MarkdownEditor", () => {
  it("switches between matching edit and preview fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestMarkdownEditor onChange={onChange} />);

    const editor = screen.getByRole("textbox", { name: "本文" });
    expect(editor).toHaveClass(
      "rounded-lg",
      "border",
      "bg-transparent",
      "px-2.5",
      "py-2",
      "text-base",
      "md:text-sm",
    );
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
      "rounded-lg",
      "border",
      "bg-transparent",
      "px-2.5",
      "py-2",
      "text-base",
      "md:text-sm",
    );
    expect(screen.getByText("即時").tagName).toBe("STRONG");

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByRole("textbox", { name: "本文" })).toBeVisible();
  });
});
