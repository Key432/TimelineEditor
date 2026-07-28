"use client";

import { useCallback, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

export type DetailFont = "gothic" | "mincho";
export type DetailWidth = "normal" | "wide" | "maximized";
export type DetailDisplayPreferences = {
  font: DetailFont;
  width: DetailWidth;
};

const STORAGE_PREFIX = "timeline-editor:detail-display:v1:";
const CHANGE_EVENT = "timeline-editor:detail-display-change";
const DEFAULT_PREFERENCES: DetailDisplayPreferences = {
  font: "gothic",
  width: "normal",
};
const fallbackPreferences = new Map<string, DetailDisplayPreferences>();
const snapshotCache = new Map<
  string,
  { raw: string | null; value: DetailDisplayPreferences }
>();

function storageKey(preferenceKey: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(preferenceKey)}`;
}

function parsePreferences(raw: string | null): DetailDisplayPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const saved = JSON.parse(raw) as Partial<DetailDisplayPreferences>;
    return {
      font: saved.font === "mincho" ? "mincho" : "gothic",
      width:
        saved.width === "wide" || saved.width === "maximized"
          ? saved.width
          : "normal",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function readPreferences(preferenceKey: string): DetailDisplayPreferences {
  const key = storageKey(preferenceKey);
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallbackPreferences.get(preferenceKey) ?? DEFAULT_PREFERENCES;
  }
  const cached = snapshotCache.get(preferenceKey);
  if (cached?.raw === raw) return cached.value;
  const value = parsePreferences(raw);
  snapshotCache.set(preferenceKey, { raw, value });
  return value;
}

function subscribe(preferenceKey: string, onStoreChange: () => void) {
  const key = storageKey(preferenceKey);
  function onStorage(event: StorageEvent) {
    if (event.key === key) onStoreChange();
  }
  function onLocalChange(event: Event) {
    if ((event as CustomEvent<string>).detail === preferenceKey) {
      onStoreChange();
    }
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onLocalChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
  };
}

function writePreferences(
  preferenceKey: string,
  preferences: DetailDisplayPreferences,
) {
  fallbackPreferences.set(preferenceKey, preferences);
  snapshotCache.delete(preferenceKey);
  try {
    window.localStorage.setItem(
      storageKey(preferenceKey),
      JSON.stringify(preferences),
    );
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, { detail: preferenceKey }),
  );
}

export function useDetailDisplayPreferences(preferenceKey: string) {
  const preferences = useSyncExternalStore(
    useCallback(
      (onStoreChange) => subscribe(preferenceKey, onStoreChange),
      [preferenceKey],
    ),
    useCallback(() => readPreferences(preferenceKey), [preferenceKey]),
    () => DEFAULT_PREFERENCES,
  );

  function updatePreferences(next: Partial<DetailDisplayPreferences>) {
    writePreferences(preferenceKey, { ...preferences, ...next });
  }

  return { preferences, updatePreferences };
}

export function DetailTypography({
  font,
  children,
}: {
  font: DetailFont;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        font === "mincho" ? "detail-font-mincho" : "detail-font-gothic",
      )}
      data-detail-font={font}
    >
      {children}
    </div>
  );
}
