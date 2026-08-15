"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { ProjectSettings } from "@/features/projects/types";

export type TimelineDomain = {
  domainStart: number;
  domainEnd: number;
  fitStart: number;
  fitEnd: number;
};

type TimelineState = {
  zoomLevel: number;
  scrollLeft: number;
  density: ProjectSettings["timelineDensity"];
  isPanning: boolean;
  viewport: {
    visibleStartOrdinal: number;
    visibleEndOrdinal: number;
    domainStartOrdinal: number;
    domainEndOrdinal: number;
  } | null;
  highlightRange: { startOrdinal: number; endOrdinal: number } | null;
  navigationRequest: { ordinal: number; nonce: number } | null;
  pointerOrdinal: number | null;
  setZoomLevel: (zoomLevel: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setDensity: (density: ProjectSettings["timelineDensity"]) => void;
  setPanning: (isPanning: boolean) => void;
  setViewport: (viewport: NonNullable<TimelineState["viewport"]>) => void;
  setHighlightRange: (highlightRange: TimelineState["highlightRange"]) => void;
  navigateTo: (ordinal: number) => void;
  setPointerOrdinal: (pointerOrdinal: number | null) => void;
};

function zoomLevelForPreset(preset: ProjectSettings["initialZoomPreset"]) {
  switch (preset) {
    case "century":
      return 2;
    case "decade":
      return 4;
    case "year":
      return 6;
    case "fit-range":
      return 0;
  }
}

export function createTimelineStore(settings: ProjectSettings) {
  return createStore<TimelineState>((set) => ({
    zoomLevel: zoomLevelForPreset(settings.initialZoomPreset),
    scrollLeft: 0,
    density: settings.timelineDensity,
    isPanning: false,
    viewport: null,
    highlightRange: null,
    navigationRequest: null,
    pointerOrdinal: null,
    setZoomLevel: (zoomLevel) => set({ zoomLevel }),
    setScrollLeft: (scrollLeft) =>
      set((state) =>
        state.scrollLeft === scrollLeft ? state : { scrollLeft },
      ),
    setDensity: (density) => set({ density }),
    setPanning: (isPanning) => set({ isPanning }),
    setViewport: (viewport) => set({ viewport }),
    setHighlightRange: (highlightRange) => set({ highlightRange }),
    navigateTo: (ordinal) =>
      set((state) => ({
        navigationRequest: {
          ordinal,
          nonce: (state.navigationRequest?.nonce ?? 0) + 1,
        },
      })),
    setPointerOrdinal: (pointerOrdinal) => set({ pointerOrdinal }),
  }));
}

export type TimelineStore = StoreApi<TimelineState>;

const TimelineStoreContext = createContext<StoreApi<TimelineState> | null>(
  null,
);

export function TimelineStoreProvider({
  settings,
  store: providedStore,
  children,
}: {
  settings: ProjectSettings;
  store?: TimelineStore;
  children: ReactNode;
}) {
  const [store] = useState(() => createTimelineStore(settings));
  return (
    <TimelineStoreContext.Provider value={providedStore ?? store}>
      {children}
    </TimelineStoreContext.Provider>
  );
}

export function useTimelineStore<T>(selector: (state: TimelineState) => T) {
  const store = useContext(TimelineStoreContext);
  if (!store) throw new Error("TimelineStoreProvider is missing.");
  return useStore(store, selector);
}
