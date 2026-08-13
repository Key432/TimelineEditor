import type {
  PdfExportOptions,
  VisualExportOptions,
  VisualExportSnapshot,
} from "@/features/visual-export/types";
import { buildVisualExportSvg } from "@/features/visual-export/svg";

const PAGE_SIZE_MM = {
  a4: [210, 297],
  a3: [297, 420],
  letter: [215.9, 279.4],
} as const;
const PX_TO_MM = 25.4 / 96;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function renderSvgToCanvas(svg: string, width: number, height: number) {
  await document.fonts?.ready;
  const maxDimension = 16_384;
  const maxPixels = 48_000_000;
  const scale = Math.min(
    2,
    maxDimension / width,
    maxDimension / height,
    Math.sqrt(maxPixels / (width * height)),
  );
  const outputWidth = Math.max(1, Math.floor(width * scale));
  const outputHeight = Math.max(1, Math.floor(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像用キャンバスを作成できません。");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, outputWidth, outputHeight);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    context.drawImage(image, 0, 0, outputWidth, outputHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNGを作成できません。")),
      "image/png",
    ),
  );
}

export function calculatePdfPagination(
  svgWidthPx: number,
  svgHeightPx: number,
  options: PdfExportOptions,
) {
  const base = PAGE_SIZE_MM[options.pageSize];
  const [pageWidth, pageHeight] =
    options.orientation === "portrait" ? base : [base[1], base[0]];
  const usableWidth = pageWidth - options.marginMm * 2;
  const usableHeight = pageHeight - options.marginMm * 2;
  if (usableWidth <= 0 || usableHeight <= 0)
    throw new Error("余白が用紙サイズを超えています。");
  const originalWidth = svgWidthPx * PX_TO_MM;
  const originalHeight = svgHeightPx * PX_TO_MM;
  const scale =
    options.scaleMode === "fit-page"
      ? Math.min(1, usableWidth / originalWidth, usableHeight / originalHeight)
      : options.scaleMode === "fit-height"
        ? Math.min(1, usableHeight / originalHeight)
        : options.scaleMode === "fit-width"
          ? Math.min(1, usableWidth / originalWidth)
          : 1;
  const renderedWidth = originalWidth * scale;
  const renderedHeight = originalHeight * scale;
  return {
    pageWidth,
    pageHeight,
    usableWidth,
    usableHeight,
    renderedWidth,
    renderedHeight,
    columns: Math.max(1, Math.ceil(renderedWidth / usableWidth)),
    rows: Math.max(1, Math.ceil(renderedHeight / usableHeight)),
  };
}

export async function downloadVisualExport(
  format: "svg" | "png" | "pdf",
  snapshot: VisualExportSnapshot,
  options: VisualExportOptions,
  pdfOptions: PdfExportOptions,
) {
  const built = buildVisualExportSvg(snapshot, options);
  const layoutLabel =
    options.layout === "row"
      ? "rows"
      : options.layout === "compact"
        ? "compact"
        : "network";
  const fileStem = `${built.fileStem}_${layoutLabel}`;
  if (format === "svg") {
    downloadBlob(
      new Blob([built.svg], { type: "image/svg+xml;charset=utf-8" }),
      `${fileStem}.svg`,
    );
    return;
  }

  const canvas = await renderSvgToCanvas(built.svg, built.width, built.height);
  if (format === "png") {
    downloadBlob(await canvasBlob(canvas), `${fileStem}.png`);
    return;
  }

  const { jsPDF } = await import("jspdf");
  const pagination = calculatePdfPagination(
    built.width,
    built.height,
    pdfOptions,
  );
  const document = new jsPDF({
    orientation: pdfOptions.orientation === "portrait" ? "p" : "l",
    unit: "mm",
    format: [pagination.pageWidth, pagination.pageHeight],
    compress: true,
  });
  const imageData = canvas.toDataURL("image/png");
  let page = 0;
  for (let row = 0; row < pagination.rows; row += 1) {
    for (let column = 0; column < pagination.columns; column += 1) {
      if (page > 0)
        document.addPage(
          [pagination.pageWidth, pagination.pageHeight],
          pdfOptions.orientation === "portrait" ? "p" : "l",
        );
      document.addImage(
        imageData,
        "PNG",
        pdfOptions.marginMm - column * pagination.usableWidth,
        pdfOptions.marginMm - row * pagination.usableHeight,
        pagination.renderedWidth,
        pagination.renderedHeight,
        undefined,
        "FAST",
      );
      page += 1;
    }
  }
  document.save(`${fileStem}.pdf`);
}
