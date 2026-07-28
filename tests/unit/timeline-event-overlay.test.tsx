import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimelineEventOverlay } from "@/features/timeline-events/timeline-event-overlay";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import { useDetailEditorActions } from "@/features/timeline-items/detail-editor-context";

const routerBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: routerBack }),
}));

function DirtyEditor() {
  const { onDirtyChange } = useDetailEditorActions();
  return (
    <button type="button" onClick={() => onDirtyChange(true)}>
      変更する
    </button>
  );
}

afterEach(() => {
  cleanup();
  routerBack.mockReset();
  vi.restoreAllMocks();
});

describe("TimelineEventOverlay", () => {
  it("keeps the overlay open when discarding unsaved edits is declined", async () => {
    const user = userEvent.setup();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(
      <TimelineEventOverlay title="詳細">
        <DetailEditShell
          editor={<DirtyEditor />}
          placement="overlay"
          preferenceKey="/projects/project-id/events/event-id"
        >
          <article>詳細本文</article>
        </DetailEditShell>
      </TimelineEventOverlay>,
    );

    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitem", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "変更する" }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(routerBack).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(routerBack).toHaveBeenCalledOnce();
  });

  it("keeps detail controls in the modal header and expands the modal smoothly", async () => {
    const user = userEvent.setup();
    render(
      <TimelineEventOverlay title="詳細">
        <DetailEditShell
          placement="overlay"
          preferenceKey="/projects/project-id/events/wide-event"
          readOnly
        >
          <article>詳細本文</article>
        </DetailEditShell>
      </TimelineEventOverlay>,
    );

    const options = screen.getByRole("button", { name: "詳細オプション" });
    const controls = options.closest("[data-detail-overlay-controls]");
    expect(controls).not.toBeNull();
    expect(controls).toHaveClass("absolute", "top-2");
    expect(screen.getByRole("button", { name: "全画面で表示" })).toHaveClass(
      "top-2",
    );

    await user.click(options);
    await user.click(
      screen.getByRole("menuitemradio", {
        name: "ワイド（左右の余白を縮小）",
      }),
    );
    expect(screen.getByRole("dialog")).toHaveClass(
      "sm:max-w-5xl",
      "transition-[max-width]",
      "duration-300",
    );

    await user.click(options);
    await user.click(screen.getByRole("menuitemradio", { name: "最大化" }));
    expect(screen.getByRole("dialog")).toHaveClass(
      "sm:max-w-[calc(100vw-2rem)]",
    );
  });
});
