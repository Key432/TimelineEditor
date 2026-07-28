"use client";

import { createContext, useContext } from "react";

type DetailEditorActions = {
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
};

export const DetailEditorContext = createContext<DetailEditorActions | null>(
  null,
);

export function useDetailEditorActions() {
  const actions = useContext(DetailEditorContext);
  if (!actions) {
    throw new Error("Detail editor must be rendered inside DetailEditShell.");
  }
  return actions;
}
