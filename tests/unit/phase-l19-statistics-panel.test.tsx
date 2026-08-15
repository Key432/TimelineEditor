import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StatisticsPanel } from "@/features/project-analysis/statistics-panel";
import type { ProjectStatistics } from "@/features/project-analysis/analysis";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const entity = {
  id: "11111111-1111-4111-8111-111111111111",
  entityType: "timeline_item" as const,
  title: "夏目漱石",
};
const datum = { key: "person", label: "人物", count: 1, entities: [entity] };

function statistics(): ProjectStatistics {
  return {
    totals: {
      itemCount: 1,
      eventCount: 0,
      relationshipCount: 0,
      internalLinkCount: 0,
    },
    countsByType: [datum],
    countsByTag: [{ ...datum, key: "author", label: "作家" }],
    countsByCentury: [{ ...datum, key: "ce:20", label: "20世紀" }],
    durationDistribution: [{ ...datum, key: "10-24", label: "10〜24年" }],
    datePrecision: [{ ...datum, key: "year", label: "年" }],
    endStatus: [{ ...datum, key: "specified", label: "終了日指定" }],
    relationshipTypes: [],
    completeness: [{ ...datum, key: "missing-source", label: "出典未入力" }],
    creationActivity: Array.from({ length: 365 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 7, 17 + index)).toISOString().slice(0, 10),
      itemCount: index === 364 ? 1 : 0,
      eventCount: 0,
    })),
  };
}

describe("Phase L19 statistics panel", () => {
  beforeEach(() => push.mockReset());

  it("renders D3 summaries and opens an entity from an aggregate", () => {
    render(
      <StatisticsPanel
        filtered
        projectId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        statistics={statistics()}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "直近1年間の作成数ヒートマップ",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/フィルター・期間強調を反映中/)).toBeVisible();
    expect(
      screen.getByRole("img", { name: "日付精度の円グラフ" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /人物/ }));
    expect(push).toHaveBeenCalledWith(
      "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/11111111-1111-4111-8111-111111111111",
    );
  });
});
