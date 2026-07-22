import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import { ProjectList } from "@/features/projects/project-list";
import type { ProjectSummary } from "@/features/projects/types";

const projects: ProjectSummary[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "説明なしの年表",
    description: null,
    visibility: "private",
    publicId: null,
    publishedAt: null,
    updatedAt: "2026-07-21T00:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "説明ありの年表",
    description: "作家と作品を比較します。",
    visibility: "public",
    publicId: "public-project-id",
    publishedAt: "2026-07-23T00:00:00Z",
    updatedAt: "2026-07-21T00:00:00Z",
  },
];

describe("ProjectList", () => {
  it("links the whole card to the timeline without showing a placeholder description", () => {
    render(
      <QueryProvider>
        <ProjectList initialProjects={projects} />
      </QueryProvider>,
    );

    expect(
      screen.getByRole("link", {
        name: "説明なしの年表のタイムラインを開く",
      }),
    ).toHaveAttribute(
      "href",
      "/projects/11111111-1111-4111-8111-111111111111/timeline",
    );
    expect(
      screen.queryByText("説明はまだありません。"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("作家と作品を比較します。")).toBeInTheDocument();
    expect(screen.getAllByText("非公開")).toHaveLength(1);
    expect(screen.getByText("公開済")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /設定を開く/ })).toHaveLength(2);
  });
});
