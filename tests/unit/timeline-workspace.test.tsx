import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import type { TimelineItemType } from "@/features/item-types/types";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import { TimelineWorkspace } from "@/features/timeline-items/timeline-workspace";
import type { Project } from "@/features/projects/types";

afterEach(cleanup);

const type: TimelineItemType = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  name: "人物",
  defaultColor: "#2878B5",
  icon: "user-round",
  sortOrder: 0,
  isVisible: true,
  isSystemSeed: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const project: Project = {
  id: type.projectId,
  name: "文学史",
  description: null,
  visibility: "private",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  settings: {
    defaultUncertaintyYears: 5,
    initialStartYear: 1800,
    initialEndYear: 2026,
    initialZoomPreset: "fit-range",
    timelineDensity: "comfortable",
    minimumTimeUnit: "day",
  },
};

function item(
  id: string,
  title: string,
  temporalType: "range" | "point",
): TimelineItemSummary {
  return {
    id,
    projectId: project.id,
    typeId: type.id,
    itemType: type,
    title,
    summary: null,
    temporalType,
    colorOverride: null,
    manualOrder: temporalType === "range" ? 0 : 1,
    isVisible: true,
    start: temporalType === "range" ? { year: 1867, month: 2, day: 9 } : null,
    isStartApproximate: true,
    startUncertaintyYears: null,
    endDateStatus: temporalType === "range" ? "specified" : null,
    end: temporalType === "range" ? { year: 1916, month: 12, day: 9 } : null,
    isEndApproximate: false,
    endUncertaintyYears: null,
    lastConfirmed: null,
    point:
      temporalType === "point" ? { year: 1905, month: null, day: null } : null,
    isPointApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("TimelineWorkspace", () => {
  it("renders distinct range and point glyphs and disables D&D for auto sort", async () => {
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentYear={2026}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
            item(
              "44444444-4444-4444-8444-444444444444",
              "吾輩は猫である",
              "point",
            ),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    expect(screen.getByLabelText(/期間型バー/)).toBeInTheDocument();
    expect(screen.getByLabelText(/時点型マーカー/)).toBeInTheDocument();
    const drag = screen.getByRole("button", { name: "夏目漱石を並べ替え" });
    expect(drag).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("並び順"), "title");
    expect(drag).toBeDisabled();
    expect(
      screen.getByText("自動並べ替え中はドラッグできません。"),
    ).toBeInTheDocument();
  });

  it("groups and collapses rows by item type", async () => {
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentYear={2026}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    await user.click(screen.getByLabelText("対象種別でグループ化"));
    const heading = screen.getByRole("button", { name: /人物/ });
    expect(screen.getByText("夏目漱石")).toBeInTheDocument();
    await user.click(heading);
    expect(screen.queryByText("夏目漱石")).not.toBeInTheDocument();
  });
});
