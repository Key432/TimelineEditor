"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { ProjectSettings } from "@/features/projects/types";

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
  navigationRequest: { ordinal: number; nonce: number } | null;
  setZoomLevel: (zoomLevel: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setDensity: (density: ProjectSettings["timelineDensity"]) => void;
  setPanning: (isPanning: boolean) => void;
  setViewport: (viewport: NonNullable<TimelineState["viewport"]>) => void;
  navigateTo: (ordinal: number) => void;
};

function zoomLevelForPreset(preset: ProjectSettings["initialZoomPreset"]) {
  switch (preset) {
    case "century":
      return 1;
    case "decade":
      return 2;
    case "year":
      return 3;
    case "fit-range":
      return 0;
  }
}

function createTimelineStore(settings: ProjectSettings) {
  return createStore<TimelineState>((set) => ({
    zoomLevel: zoomLevelForPreset(settings.initialZoomPreset),
    scrollLeft: 0,
    density: settings.timelineDensity,
    isPanning: false,
    viewport: null,
    navigationRequest: null,
    setZoomLevel: (zoomLevel) => set({ zoomLevel }),
    setScrollLeft: (scrollLeft) =>
      set((state) =>
        state.scrollLeft === scrollLeft ? state : { scrollLeft },
      ),
    setDensity: (density) => set({ density }),
    setPanning: (isPanning) => set({ isPanning }),
    setViewport: (viewport) => set({ viewport }),
    navigateTo: (ordinal) =>
      set((state) => ({
        navigationRequest: {
          ordinal,
          nonce: (state.navigationRequest?.nonce ?? 0) + 1,
        },
      })),
  }));
}

const TimelineStoreContext = createContext<StoreApi<TimelineState> | null>(
  null,
);

export function TimelineStoreProvider({
  settings,
  children,
}: {
  settings: ProjectSettings;
  children: ReactNode;
}) {
  const [store] = useState(() => createTimelineStore(settings));
  return (
    <TimelineStoreContext.Provider value={store}>
      {children}
    </TimelineStoreContext.Provider>
  );
}

export function useTimelineStore<T>(selector: (state: TimelineState) => T) {
  const store = useContext(TimelineStoreContext);
  if (!store) throw new Error("TimelineStoreProvider is missing.");
  return useStore(store, selector);
}
