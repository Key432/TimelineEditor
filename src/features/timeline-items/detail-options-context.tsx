"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ComponentType,
} from "react";

export type DetailOptionAction = {
  id: string;
  label: string;
  icon: ComponentType<{ "aria-hidden"?: "true" }>;
  variant?: "default" | "destructive";
  onSelect: () => void;
};

type DetailOptionsRegistration = {
  register: (action: DetailOptionAction) => void;
  unregister: (id: string) => void;
};

export const DetailOptionsContext =
  createContext<DetailOptionsRegistration | null>(null);

export function useRegisterDetailOption(
  action: DetailOptionAction,
  enabled: boolean,
) {
  const registration = useContext(DetailOptionsContext);
  useEffect(() => {
    if (!enabled || !registration) return;
    registration.register(action);
    return () => registration.unregister(action.id);
  }, [action, enabled, registration]);
}
