import { NextResponse } from "next/server";

import { ServiceError } from "@/lib/services/errors";

export function apiErrorResponse(error: unknown) {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
        },
      },
      { status: error.status },
    );
  }

  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "処理に失敗しました。" } },
    { status: 500 },
  );
}
