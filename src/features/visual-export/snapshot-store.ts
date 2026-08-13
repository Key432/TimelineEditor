"use client";

import { useSyncExternalStore } from "react";

import type { VisualExportSnapshot } from "@/features/visual-export/types";

const snapshots = new Map<string, VisualExportSnapshot>();
const listeners = new Map<string, Set<() => void>>();

export function publishVisualExportSnapshot(
  projectId: string,
  snapshot: VisualExportSnapshot,
) {
  snapshots.set(projectId, snapshot);
  for (const listener of listeners.get(projectId) ?? []) listener();
}

export function useVisualExportSnapshot(projectId: string) {
  return useSyncExternalStore(
    (listener) => {
      const projectListeners = listeners.get(projectId) ?? new Set();
      projectListeners.add(listener);
      listeners.set(projectId, projectListeners);
      return () => {
        projectListeners.delete(listener);
        if (projectListeners.size === 0) listeners.delete(projectId);
      };
    },
    () => snapshots.get(projectId) ?? null,
    () => null,
  );
}
