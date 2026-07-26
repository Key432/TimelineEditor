"use client";

import { useSyncExternalStore } from "react";

function getFullscreenPortalContainer() {
  if (typeof document === "undefined") return null;
  return document.fullscreenElement instanceof HTMLElement
    ? document.fullscreenElement
    : null;
}

export function useFullscreenPortalContainer() {
  return (
    useSyncExternalStore(
      (onStoreChange) => {
        document.addEventListener("fullscreenchange", onStoreChange);
        return () =>
          document.removeEventListener("fullscreenchange", onStoreChange);
      },
      getFullscreenPortalContainer,
      () => null,
    ) ?? undefined
  );
}
