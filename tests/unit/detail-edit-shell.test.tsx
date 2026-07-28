import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import { useDetailEditorActions } from "@/features/timeline-items/detail-editor-context";

function TestEditor() {
  const { onDirtyChange, onSaved } = useDetailEditorActions();
  return (
    <div>
      <button type="button" onClick={() => onDirtyChange(true)}>
        変更する
      </button>
      <button type="button" onClick={onSaved}>
        保存する
      </button>
    </div>
  );
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DetailEditShell", () => {
  it("switches between view and edit without navigation and supports three widths", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DetailEditShell
        editor={<TestEditor />}
        preferenceKey="/projects/project-id/items/item-id"
      >
        <article>詳細本文</article>
      </DetailEditShell>,
    );

    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(
      screen.getByRole("menuitemradio", {
        name: "ワイド（左右の余白を縮小）",
      }),
    );
    expect(container.firstElementChild).toHaveAttribute(
      "data-detail-width",
      "wide",
    );
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitem", { name: "編集" }));
    expect(container.firstElementChild).toHaveAttribute(
      "data-detail-mode",
      "edit",
    );
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitemradio", { name: "最大化" }));
    expect(container.firstElementChild).toHaveAttribute(
      "data-detail-width",
      "maximized",
    );
    await user.click(screen.getByRole("button", { name: "保存する" }));
    expect(screen.getByText("詳細本文")).toBeVisible();
    expect(container.firstElementChild).toHaveAttribute(
      "data-detail-width",
      "maximized",
    );
  });

  it("confirms before discarding dirty edits", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(
      <DetailEditShell
        editor={<TestEditor />}
        preferenceKey="/projects/project-id/items/dirty-item"
      >
        <article>詳細本文</article>
      </DetailEditShell>,
    );

    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitem", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "変更する" }));
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitem", { name: "閲覧に戻る" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "保存する" })).toBeVisible();
  });

  it("restores width and font for the same page without sharing them to another page", async () => {
    const user = userEvent.setup();
    const first = render(
      <DetailEditShell preferenceKey="/public/shared/items/item-id" readOnly>
        <article>項目詳細</article>
      </DetailEditShell>,
    );
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitemradio", { name: "明朝" }));
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitemradio", { name: "最大化" }));
    expect(
      first.container.querySelector("[data-detail-font='mincho']"),
    ).toBeVisible();
    first.unmount();

    const second = render(
      <DetailEditShell preferenceKey="/public/shared/items/item-id" readOnly>
        <article>同じ項目詳細</article>
      </DetailEditShell>,
    );
    expect(
      second.container.querySelector("[data-detail-font='mincho']"),
    ).toBeVisible();
    expect(second.container.firstElementChild).toHaveAttribute(
      "data-detail-width",
      "maximized",
    );
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    expect(screen.getByRole("menuitemradio", { name: "明朝" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    second.unmount();

    const third = render(
      <DetailEditShell preferenceKey="/public/shared/events/event-id" readOnly>
        <article>別イベント詳細</article>
      </DetailEditShell>,
    );
    expect(
      third.container.querySelector("[data-detail-font='gothic']"),
    ).toBeVisible();
    expect(third.container.firstElementChild).toHaveAttribute(
      "data-detail-width",
      "normal",
    );
  });

  it("widens the detail body when horizontal margins are reduced", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DetailEditShell
        preferenceKey="/projects/project-id/events/wide-event"
        readOnly
      >
        <article>詳細本文</article>
      </DetailEditShell>,
    );

    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(
      screen.getByRole("menuitemradio", {
        name: "ワイド（左右の余白を縮小）",
      }),
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-detail-width",
      "wide",
    );
    expect(container.firstElementChild).toHaveClass("max-w-[1400px]");
  });
});
