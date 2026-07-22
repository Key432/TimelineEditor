import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TimelineItemEventList } from "@/features/timeline-items/timeline-item-event-list";

describe("TimelineItemEventList", () => {
  it("expands a compact list with event titles, dates, and detail links", async () => {
    const user = userEvent.setup();
    render(
      <TimelineItemEventList
        events={[
          {
            id: "event-id",
            projectId: "project-id",
            timelineItemId: "item-id",
            title: "代表作を刊行",
            date: { year: 1907, month: 3, day: null },
            isApproximate: true,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ]}
        projectId="project-id"
      />,
    );

    await user.click(screen.getByText("イベント 1件"));
    expect(screen.getByText("代表作を刊行")).toBeVisible();
    expect(screen.getByText("約 1907/03")).toBeVisible();
    expect(screen.getByRole("link", { name: "代表作を刊行" })).toHaveAttribute(
      "href",
      "/projects/project-id/events/event-id",
    );
  });
});
