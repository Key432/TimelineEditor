import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { QueryProvider } from "@/components/query-provider";
import { RelationshipDraftEditor } from "@/features/relationships/relationship-draft-editor";
import type { RelationshipDraft } from "@/features/relationships/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const [value, setValue] = useState<RelationshipDraft[]>([]);
  return (
    <RelationshipDraftEditor
      projectId="project-1"
      sourceType="timeline_item"
      value={value}
      onChange={setValue}
    />
  );
}

describe("new entity relationship drafts", () => {
  it("adds and removes a styled relationship before the entity is saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          dataset: {
            relationships: [],
            entities: [
              { type: "timeline_item", id: "target-1", title: "BBBB" },
            ],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <Harness />
      </QueryProvider>,
    );

    await screen.findByRole("option", { name: "BBBB" });
    await user.selectOptions(screen.getByLabelText("関係先"), "target-1");
    await user.clear(screen.getByLabelText("関係種別"));
    await user.type(screen.getByLabelText("関係種別"), "思想的継承");
    await user.selectOptions(screen.getByLabelText("線"), "double");
    await user.click(screen.getByLabelText("終点に矢印"));
    await user.click(screen.getByRole("button", { name: "関係性を追加" }));

    expect(screen.getByText("思想的継承", { exact: true })).toBeVisible();
    expect(screen.getByText("BBBB", { exact: true })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "思想的継承の関係性を削除" }),
    );
    expect(screen.queryByText("思想的継承", { exact: true })).toBeNull();
  });
});
