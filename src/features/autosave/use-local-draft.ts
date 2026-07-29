"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteLocalDraft,
  draftFingerprint,
  getLocalDraft,
  putLocalDraft,
  type LocalDraft,
} from "@/features/autosave/draft-store";

export type LocalDraftStatus =
  | "saved"
  | "saving"
  | "unsaved"
  | "failed"
  | "offline"
  | "retrying"
  | "conflict";

const CHANNEL_NAME = "chronology-studio-drafts";

function createWriterId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function useLocalDraft<T>({
  baseVersion,
  dirty,
  draftKey,
  onRestore,
  value,
  debounceMs = 800,
}: {
  baseVersion: string | null;
  dirty: boolean;
  draftKey: string;
  onRestore: (value: T) => void;
  value: T;
  debounceMs?: number;
}) {
  const initializationKey = `${draftKey}\u0000${baseVersion ?? ""}`;
  const [initializedKey, setInitializedKey] = useState<string | null>(null);
  const ready = initializedKey === initializationKey;
  const [status, setStatus] = useState<LocalDraftStatus>("saved");
  const initialized = useRef(false);
  const writing = useRef(false);
  const activeWrite = useRef<Promise<void> | null>(null);
  const queued = useRef<LocalDraft<T> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFingerprint = useRef<string | null>(null);
  const latest = useRef(value);
  const writerId = useRef(createWriterId());
  const conflict = useRef(false);
  const suspended = useRef(false);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  const setConnectivityStatus = useCallback(
    (next: Exclude<LocalDraftStatus, "offline">) => {
      setStatus(navigator.onLine ? next : "offline");
    },
    [],
  );

  const persist = useCallback(
    async (nextValue: T, retrying = false) => {
      if (!initialized.current || conflict.current || suspended.current) return;
      const fingerprint = draftFingerprint(nextValue);
      if (fingerprint === lastSavedFingerprint.current) {
        setConnectivityStatus("saved");
        return;
      }
      const draft: LocalDraft<T> = {
        key: draftKey,
        value: nextValue,
        baseVersion,
        fingerprint,
        savedAt: new Date().toISOString(),
        writerId: writerId.current,
      };
      if (writing.current) {
        queued.current = draft;
        setConnectivityStatus("unsaved");
        return;
      }
      writing.current = true;
      try {
        let next: LocalDraft<T> | null = draft;
        let isRetry = retrying;
        while (next && !conflict.current && !suspended.current) {
          const current = next;
          queued.current = null;
          setConnectivityStatus(isRetry ? "retrying" : "saving");
          try {
            const write = putLocalDraft(current);
            activeWrite.current = write;
            await write;
            lastSavedFingerprint.current = current.fingerprint;
            const channel = new BroadcastChannel(CHANNEL_NAME);
            channel.postMessage({
              key: draftKey,
              fingerprint: current.fingerprint,
              writerId: writerId.current,
            });
            channel.close();
            setConnectivityStatus("saved");
          } catch {
            setConnectivityStatus("failed");
          } finally {
            activeWrite.current = null;
          }
          next = queued.current;
          isRetry = false;
        }
      } finally {
        activeWrite.current = null;
        writing.current = false;
        queued.current = null;
      }
    },
    [baseVersion, draftKey, setConnectivityStatus],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (dirty) void persist(latest.current);
  }, [dirty, persist]);

  const discard = useCallback(async () => {
    suspended.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queued.current = null;
    await activeWrite.current?.catch(() => undefined);
    await deleteLocalDraft(draftKey);
    lastSavedFingerprint.current = null;
    conflict.current = false;
    setConnectivityStatus("saved");
  }, [draftKey, setConnectivityStatus]);

  const retry = useCallback(() => {
    suspended.current = false;
    conflict.current = false;
    void persist(latest.current, true);
  }, [persist]);

  useEffect(() => {
    let active = true;
    initialized.current = false;
    conflict.current = false;
    suspended.current = false;
    void getLocalDraft<T>(draftKey)
      .then((draft) => {
        if (!active) return;
        if (draft && draft.baseVersion === baseVersion) {
          lastSavedFingerprint.current = draft.fingerprint;
          onRestore(draft.value);
        } else if (draft) {
          lastSavedFingerprint.current = draft.fingerprint;
          onRestore(draft.value);
          conflict.current = true;
          setStatus("conflict");
        }
      })
      .catch(() => {
        if (active) setConnectivityStatus("failed");
      })
      .finally(() => {
        if (active) {
          initialized.current = true;
          setInitializedKey(initializationKey);
        }
      });
    return () => {
      active = false;
    };
  }, [
    baseVersion,
    draftKey,
    initializationKey,
    onRestore,
    setConnectivityStatus,
  ]);

  useEffect(() => {
    if (!ready || !initialized.current || conflict.current) return;
    if (!dirty) {
      if (lastSavedFingerprint.current === null && !writing.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      queued.current = null;
      let active = true;
      void (async () => {
        await activeWrite.current?.catch(() => undefined);
        await deleteLocalDraft(draftKey);
        lastSavedFingerprint.current = null;
        if (active) setConnectivityStatus("saved");
      })().catch(() => {
        if (active) setConnectivityStatus("failed");
      });
      return () => {
        active = false;
      };
    }
    const fingerprint = draftFingerprint(value);
    if (fingerprint === lastSavedFingerprint.current) {
      setConnectivityStatus("saved");
      return;
    }
    setConnectivityStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(value), debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [
    debounceMs,
    dirty,
    draftKey,
    persist,
    ready,
    setConnectivityStatus,
    value,
  ]);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (
      event: MessageEvent<{
        key?: string;
        fingerprint?: string;
        writerId?: string;
      }>,
    ) => {
      if (
        event.data.key === draftKey &&
        event.data.writerId !== writerId.current &&
        event.data.fingerprint !== lastSavedFingerprint.current
      ) {
        conflict.current = true;
        if (timer.current) clearTimeout(timer.current);
        setStatus("conflict");
      }
    };
    return () => channel.close();
  }, [draftKey]);

  useEffect(() => {
    const update = () =>
      setStatus((current) => {
        if (current === "conflict") return current;
        if (!navigator.onLine) return "offline";
        return current === "offline" ? "saved" : current;
      });
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return { discard, flush, retry, status };
}
