import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import { ImportExportManager } from "@/features/import-export/import-export-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("ImportExportManager", () => {
  it("exposes keyboard-accessible export links and labeled import controls", () => {
    render(
      <QueryProvider>
        <ImportExportManager projectId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" />
      </QueryProvider>,
    );
    expect(screen.getByRole("link", { name: /JSONを保存/ })).toHaveAttribute(
      "href",
      "/api/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/export/json",
    );
    expect(screen.getByRole("link", { name: /CSV ZIPを保存/ })).toHaveAttribute(
      "href",
      "/api/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/export/csv",
    );
    expect(screen.getByLabelText("JSONバックアップ")).toHaveAttribute(
      "type",
      "file",
    );
    expect(screen.getByLabelText("CSVまたはCSV ZIP")).toHaveAttribute(
      "type",
      "file",
    );
    expect(screen.queryByText(/既定は別プロジェクト/)).not.toBeInTheDocument();
    expect(
      screen.getByText("タイムラインを画像・PDFで出力"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("出力する表示")).toHaveTextContent(
      "関連ネットワーク",
    );
    expect(screen.getByLabelText("出力範囲")).toHaveTextContent(
      "全データを出力",
    );
    expect(screen.getByRole("button", { name: "PDFを保存" })).toBeDisabled();
    expect(
      screen
        .getAllByRole("button", { name: /(?:PDF|SVG|PNG)を保存/ })
        .map((button) => button.textContent),
    ).toEqual(["PDFを保存", "SVGを保存", "PNGを保存"]);
    expect(
      screen.queryByText(/生成ファイルはサーバーへ保存しません/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/日本語はブラウザで描画してPDFへ埋め込みます/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/元ファイルは保存しません/),
    ).not.toBeInTheDocument();
  });
});
