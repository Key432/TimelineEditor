import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewProjectImport } from "@/features/import-export/new-project-import";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("NewProjectImport", () => {
  it("offers JSON and CSV ZIP as accessible new-project sources", () => {
    render(<NewProjectImport />);
    expect(screen.getByLabelText("JSONから新規作成")).toHaveAttribute(
      "accept",
      "application/json,.json",
    );
    expect(screen.getByLabelText("CSV ZIPから新規作成")).toHaveAttribute(
      "accept",
      "application/zip,.zip",
    );
  });
});
