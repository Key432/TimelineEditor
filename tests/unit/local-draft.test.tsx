import { act, cleanup, render, screen } from "@testing-library/react";
import { useCallback } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalDraft } from "@/features/autosave/use-local-draft";

const store = vi.hoisted(() => ({
  deleteLocalDraft: vi.fn(),
  getLocalDraft: vi.fn(),
  putLocalDraft: vi.fn(),
}));

vi.mock("@/features/autosave/draft-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/autosave/draft-store")>()),
  deleteLocalDraft: store.deleteLocalDraft,
  getLocalDraft: store.getLocalDraft,
  putLocalDraft: store.putLocalDraft,
}));

type ChannelMessage = { key: string; fingerprint: string; writerId: string };

class TestBroadcastChannel {
  static channels: TestBroadcastChannel[] = [];
  onmessage: ((event: MessageEvent<ChannelMessage>) => void) | null = null;

  constructor(readonly name: string) {
    TestBroadcastChannel.channels.push(this);
  }

  postMessage(message: ChannelMessage) {
    for (const channel of TestBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        channel.onmessage?.(new MessageEvent("message", { data: message }));
      }
    }
  }

  close() {
    TestBroadcastChannel.channels = TestBroadcastChannel.channels.filter(
      (channel) => channel !== this,
    );
  }
}

const noopRestore = () => undefined;

function Harness({
  value,
  dirty = true,
  baseVersion = "version-1",
  onRestore = noopRestore,
}: {
  value: { title: string };
  dirty?: boolean;
  baseVersion?: string;
  onRestore?: (value: { title: string }) => void;
}) {
  const restore = useCallback(
    (draft: { title: string }) => onRestore(draft),
    [onRestore],
  );
  const draft = useLocalDraft({
    baseVersion,
    debounceMs: 800,
    dirty,
    draftKey: "timeline-item:project:item",
    onRestore: restore,
    value,
  });
  return (
    <div>
      <output>{draft.status}</output>
      <button type="button" onClick={draft.flush}>
        flush
      </button>
      <button type="button" onClick={draft.retry}>
        retry
      </button>
      <button type="button" onClick={() => void draft.discard()}>
        discard
      </button>
    </div>
  );
}

async function settlePromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useLocalDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
    TestBroadcastChannel.channels = [];
    store.getLocalDraft.mockResolvedValue(null);
    store.putLocalDraft.mockResolvedValue(undefined);
    store.deleteLocalDraft.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("restores a matching draft after remounting", async () => {
    const onRestore = vi.fn();
    store.getLocalDraft.mockResolvedValue({
      key: "timeline-item:project:item",
      value: { title: "復元した下書き" },
      baseVersion: "version-1",
      fingerprint: '{"title":"復元した下書き"}',
      savedAt: "2026-07-29T00:00:00.000Z",
      writerId: "previous-tab",
    });

    render(
      <Harness
        dirty={false}
        value={{ title: "確定済み" }}
        onRestore={onRestore}
      />,
    );

    await settlePromises();
    expect(onRestore).toHaveBeenCalledWith({ title: "復元した下書き" });
  });

  it("restores but flags a draft based on an older DB version", async () => {
    const onRestore = vi.fn();
    store.getLocalDraft.mockResolvedValue({
      key: "timeline-item:project:item",
      value: { title: "競合した下書き" },
      baseVersion: "old-version",
      fingerprint: '{"title":"競合した下書き"}',
      savedAt: "2026-07-29T00:00:00.000Z",
      writerId: "previous-tab",
    });

    render(
      <Harness
        dirty={false}
        value={{ title: "DBの最新版" }}
        onRestore={onRestore}
      />,
    );
    await settlePromises();
    expect(onRestore).toHaveBeenCalledWith({ title: "競合した下書き" });
    expect(screen.getByText("conflict")).toBeVisible();
  });

  it("debounces writes and avoids sending identical content twice", async () => {
    const view = render(
      <Harness dirty={false} value={{ title: "確定済み" }} />,
    );
    await settlePromises();
    view.rerender(<Harness value={{ title: "下書き" }} />);

    await act(async () => vi.advanceTimersByTime(799));
    expect(store.putLocalDraft).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    await settlePromises();
    expect(store.putLocalDraft).toHaveBeenCalledOnce();

    view.rerender(<Harness value={{ title: "下書き" }} />);
    await act(async () => vi.advanceTimersByTime(800));
    expect(store.putLocalDraft).toHaveBeenCalledOnce();
  });

  it("flushes immediately on focus movement and reports another-tab conflicts", async () => {
    const view = render(
      <Harness dirty={false} value={{ title: "確定済み" }} />,
    );
    await settlePromises();
    view.rerender(<Harness value={{ title: "下書き" }} />);
    screen.getByRole("button", { name: "flush" }).click();
    await settlePromises();
    expect(store.putLocalDraft).toHaveBeenCalledOnce();

    act(() => {
      TestBroadcastChannel.channels[0]?.onmessage?.(
        new MessageEvent("message", {
          data: {
            key: "timeline-item:project:item",
            fingerprint: "different",
            writerId: "another-tab",
          },
        }),
      );
    });
    expect(screen.getByText("conflict")).toBeVisible();
  });

  it("keeps a failed draft available for retry", async () => {
    store.putLocalDraft
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(undefined);
    const view = render(
      <Harness dirty={false} value={{ title: "確定済み" }} />,
    );
    await settlePromises();
    view.rerender(<Harness value={{ title: "下書き" }} />);
    screen.getByRole("button", { name: "flush" }).click();
    await settlePromises();
    expect(screen.getByText("failed")).toBeVisible();

    screen.getByRole("button", { name: "retry" }).click();
    await settlePromises();
    expect(store.putLocalDraft).toHaveBeenCalledTimes(2);
    expect(screen.getByText("saved")).toBeVisible();
  });

  it("waits for an in-flight write before deleting a confirmed draft", async () => {
    let finishWrite: (() => void) | undefined;
    store.putLocalDraft.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );
    const view = render(
      <Harness dirty={false} value={{ title: "確定済み" }} />,
    );
    await settlePromises();
    view.rerender(<Harness value={{ title: "下書き" }} />);
    screen.getByRole("button", { name: "flush" }).click();
    await settlePromises();
    screen.getByRole("button", { name: "discard" }).click();
    await settlePromises();
    expect(store.deleteLocalDraft).not.toHaveBeenCalled();

    finishWrite?.();
    await settlePromises();
    expect(store.deleteLocalDraft).toHaveBeenCalledOnce();
  });

  it("queues changes made while a draft write is in progress", async () => {
    let finishFirstWrite: (() => void) | undefined;
    store.putLocalDraft.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishFirstWrite = resolve;
      }),
    );
    const view = render(
      <Harness dirty={false} value={{ title: "確定済み" }} />,
    );
    await settlePromises();
    view.rerender(<Harness value={{ title: "1件目" }} />);
    screen.getByRole("button", { name: "flush" }).click();
    await settlePromises();
    view.rerender(<Harness value={{ title: "2件目" }} />);
    screen.getByRole("button", { name: "flush" }).click();
    await settlePromises();
    expect(store.putLocalDraft).toHaveBeenCalledOnce();

    finishFirstWrite?.();
    await settlePromises();
    expect(store.putLocalDraft).toHaveBeenCalledTimes(2);
    expect(store.putLocalDraft.mock.calls[1]?.[0]).toMatchObject({
      value: { title: "2件目" },
    });
  });

  it("shows offline state without preventing local initialization", async () => {
    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    render(<Harness dirty={false} value={{ title: "確定済み" }} />);
    await settlePromises();
    expect(screen.getByText("offline")).toBeVisible();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: originalOnline,
    });
  });

  it("removes the local draft when the form is reverted to its DB values", async () => {
    const view = render(
      <Harness dirty={false} value={{ title: "確定済み" }} />,
    );
    await settlePromises();
    view.rerender(<Harness value={{ title: "下書き" }} />);
    screen.getByRole("button", { name: "flush" }).click();
    await settlePromises();
    expect(store.putLocalDraft).toHaveBeenCalledOnce();

    view.rerender(<Harness dirty={false} value={{ title: "確定済み" }} />);
    await settlePromises();
    expect(store.deleteLocalDraft).toHaveBeenCalledOnce();
  });
});
