"use client";

import { createContext, useContext } from "react";

import type { DetailWidth } from "@/features/timeline-items/detail-display-preferences";

export const DetailOverlayCloseGuardContext = createContext<
  ((dirty: boolean) => void) | null
>(null);

export function useDetailOverlayCloseGuard() {
  return useContext(DetailOverlayCloseGuardContext);
}

export const DetailOverlayWidthContext = createContext<
  ((width: DetailWidth) => void) | null
>(null);

export function useDetailOverlayWidth() {
  return useContext(DetailOverlayWidthContext);
}

export const DetailOverlayControlsContext = createContext<HTMLElement | null>(
  null,
);

export function useDetailOverlayControls() {
  return useContext(DetailOverlayControlsContext);
}
