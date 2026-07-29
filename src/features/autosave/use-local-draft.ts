"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CloudDraftConflictError,
  deleteCloudDraft,
  getCloudDraft,
  saveCloudDraft,
} from "@/features/autosave/api";
import {
  deleteLocalDraft,
  draftFingerprint,
  getLocalDraft,
  putLocalDraft,
  type LocalDraft,
} from "@/features/autosave/draft-store";
import type {
  CloudDraft,
  CloudDraftEntityType,
} from "@/features/autosave/types";
import type { Json } from "@/lib/supabase/database.types";

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
  projectId,
  entityType,
  draftScope,
  onRestore,
  value,
  debounceMs = 800,
}: {
  baseVersion: string | null;
  dirty: boolean;
  draftKey: string;
  projectId: string;
  entityType: CloudDraftEntityType;
  draftScope: string;
  onRestore: (value: T) => void;
  value: T;
  debounceMs?: number;
}) {
  const initializationKey = `${draftKey}\u0000${baseVersion ?? ""}`;
  const [initializedKey, setInitializedKey] = useState<string | null>(null);
  const ready = initializedKey === initializationKey;
  const currentFingerprint = draftFingerprint(value);
  const [status, setStatus] = useState<LocalDraftStatus>("saved");
  const [canUseCloudVersion, setCanUseCloudVersion] = useState(false);
  const initialized = useRef(false);
  const writing = useRef(false);
  const activeWrite = useRef<Promise<void> | null>(null);
  const queued = useRef<LocalDraft<T> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalFingerprint = useRef<string | null>(null);
  const cloudFingerprint = useRef<string | null>(null);
  const cloudVersion = useRef<number | null>(null);
  const conflictingCloudDraft = useRef<CloudDraft<T> | null>(null);
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
    async (
      nextValue: T,
      retrying = false,
      expectedVersion = cloudVersion.current,
    ) => {
      if (!initialized.current || suspended.current) return;
      const fingerprint = draftFingerprint(nextValue);
      if (
        fingerprint === lastLocalFingerprint.current &&
        fingerprint === cloudFingerprint.current
      ) {
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
        let nextExpectedVersion = expectedVersion;
        while (next && !suspended.current) {
          const current = next;
          queued.current = null;
          setConnectivityStatus(isRetry ? "retrying" : "saving");
          try {
            const write = (async () => {
              await putLocalDraft(current);
              lastLocalFingerprint.current = current.fingerprint;
              const channel = new BroadcastChannel(CHANNEL_NAME);
              channel.postMessage({
                key: draftKey,
                fingerprint: current.fingerprint,
                writerId: writerId.current,
              });
              channel.close();
              if (!navigator.onLine) {
                setStatus("offline");
                return;
              }
              const saved = await saveCloudDraft<T>(
                projectId,
                entityType,
                draftScope,
                {
                  value: current.value as Json,
                  baseVersion: current.baseVersion,
                  fingerprint: current.fingerprint,
                  writerId: current.writerId,
                  expectedVersion: nextExpectedVersion,
                },
              );
              cloudVersion.current = saved.version;
              cloudFingerprint.current = saved.fingerprint;
              conflictingCloudDraft.current = null;
              setCanUseCloudVersion(false);
              conflict.current = false;
              nextExpectedVersion = saved.version;
              setConnectivityStatus("saved");
            })();
            activeWrite.current = write;
            await write;
          } catch (error) {
            if (error instanceof CloudDraftConflictError) {
              conflictingCloudDraft.current = error.current as CloudDraft<T>;
              setCanUseCloudVersion(error.current !== null);
              conflict.current = true;
              setStatus("conflict");
            } else {
              setConnectivityStatus("failed");
            }
          } finally {
            activeWrite.current = null;
          }
          if (conflict.current) break;
          next = queued.current;
          isRetry = false;
        }
      } finally {
        activeWrite.current = null;
        writing.current = false;
        queued.current = null;
      }
    },
    [
      baseVersion,
      draftKey,
      draftScope,
      entityType,
      projectId,
      setConnectivityStatus,
    ],
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
    await deleteCloudDraft(projectId, entityType, draftScope);
    await deleteLocalDraft(draftKey);
    lastLocalFingerprint.current = null;
    cloudFingerprint.current = null;
    cloudVersion.current = null;
    conflict.current = false;
    setConnectivityStatus("saved");
  }, [draftKey, draftScope, entityType, projectId, setConnectivityStatus]);

  const retry = useCallback(() => {
    suspended.current = false;
    if (conflict.current) return;
    void persist(latest.current, true);
  }, [persist]);

  const useCloudVersion = useCallback(() => {
    const remote = conflictingCloudDraft.current;
    if (!remote) return;
    onRestore(remote.value);
    void putLocalDraft({
      key: draftKey,
      value: remote.value,
      baseVersion: remote.baseVersion,
      fingerprint: remote.fingerprint,
      savedAt: remote.savedAt,
      writerId: remote.writerId,
    });
    lastLocalFingerprint.current = remote.fingerprint;
    cloudFingerprint.current = remote.fingerprint;
    cloudVersion.current = remote.version;
    conflictingCloudDraft.current = null;
    setCanUseCloudVersion(false);
    conflict.current = false;
    setConnectivityStatus("saved");
  }, [draftKey, onRestore, setConnectivityStatus]);

  const useThisDeviceVersion = useCallback(() => {
    const remote = conflictingCloudDraft.current;
    if (remote) cloudVersion.current = remote.version;
    conflictingCloudDraft.current = null;
    setCanUseCloudVersion(false);
    conflict.current = false;
    suspended.current = false;
    void persist(latest.current, true, cloudVersion.current);
  }, [persist]);

  useEffect(() => {
    let active = true;
    initialized.current = false;
    conflict.current = false;
    suspended.current = false;
    void Promise.all([
      getLocalDraft<T>(draftKey),
      navigator.onLine
        ? getCloudDraft<T>(projectId, entityType, draftScope)
        : Promise.resolve(null),
    ])
      .then(async ([local, remote]) => {
        if (!active) return;
        cloudVersion.current = remote?.version ?? null;
        cloudFingerprint.current = remote?.fingerprint ?? null;
        setCanUseCloudVersion(false);
        const differentDrafts =
          local && remote && local.fingerprint !== remote.fingerprint;
        const selected =
          differentDrafts ||
          (local && (!remote || local.savedAt >= remote.savedAt))
            ? local
            : remote;
        if (selected) {
          lastLocalFingerprint.current = selected.fingerprint;
          onRestore(selected.value);
          if ("version" in selected) {
            await putLocalDraft({
              key: draftKey,
              value: selected.value,
              baseVersion: selected.baseVersion,
              fingerprint: selected.fingerprint,
              savedAt: selected.savedAt,
              writerId: selected.writerId,
            });
          }
        }
        if (
          differentDrafts ||
          (selected && selected.baseVersion !== baseVersion)
        ) {
          conflictingCloudDraft.current = remote;
          setCanUseCloudVersion(remote !== null);
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
    draftScope,
    entityType,
    initializationKey,
    onRestore,
    projectId,
    setConnectivityStatus,
  ]);

  useEffect(() => {
    if (!ready || !initialized.current || conflict.current) return;
    if (!dirty) {
      if (
        lastLocalFingerprint.current === null &&
        cloudFingerprint.current === null &&
        !writing.current
      )
        return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      queued.current = null;
      let active = true;
      void (async () => {
        await activeWrite.current?.catch(() => undefined);
        await deleteCloudDraft(projectId, entityType, draftScope);
        await deleteLocalDraft(draftKey);
        lastLocalFingerprint.current = null;
        cloudFingerprint.current = null;
        cloudVersion.current = null;
        if (active) setConnectivityStatus("saved");
      })().catch(() => {
        if (active) setConnectivityStatus("failed");
      });
      return () => {
        active = false;
      };
    }
    const fingerprint = currentFingerprint;
    if (
      fingerprint === lastLocalFingerprint.current &&
      fingerprint === cloudFingerprint.current
    ) {
      setConnectivityStatus("saved");
      return;
    }
    if (writing.current && fingerprint === lastLocalFingerprint.current) return;
    setConnectivityStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(latest.current), debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [
    debounceMs,
    currentFingerprint,
    dirty,
    draftKey,
    draftScope,
    entityType,
    persist,
    projectId,
    ready,
    setConnectivityStatus,
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
        event.data.fingerprint !== lastLocalFingerprint.current
      ) {
        conflict.current = true;
        if (timer.current) clearTimeout(timer.current);
        setStatus("conflict");
      }
    };
    return () => channel.close();
  }, [draftKey]);

  useEffect(() => {
    const update = () => {
      if (!navigator.onLine) {
        setStatus((current) => (current === "conflict" ? current : "offline"));
      } else if (!conflict.current) {
        void persist(latest.current, true);
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (!navigator.onLine) update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [persist]);

  return {
    discard,
    flush,
    retry,
    status,
    canUseCloudVersion,
    useCloudVersion,
    useThisDeviceVersion,
  };
}
