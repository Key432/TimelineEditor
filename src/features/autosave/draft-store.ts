export const DRAFT_DATABASE_NAME = "chronology-studio-drafts";
export const DRAFT_STORE_NAME = "drafts";
export const DRAFT_DATABASE_VERSION = 1;

export type LocalDraft<T> = {
  key: string;
  value: T;
  baseVersion: string | null;
  fingerprint: string;
  savedAt: string;
  writerId: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE_NAME, DRAFT_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        database.createObjectStore(DRAFT_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDBを開けませんでした。"));
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(DRAFT_STORE_NAME, mode);
      const request = operation(transaction.objectStore(DRAFT_STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("下書きを保存できませんでした。"));
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("下書きを保存できませんでした。"),
        );
    });
  } finally {
    database.close();
  }
}

export async function getLocalDraft<T>(key: string) {
  const result = await transact<LocalDraft<T> | undefined>(
    "readonly",
    (store) => store.get(key),
  );
  return result ?? null;
}

export async function putLocalDraft<T>(draft: LocalDraft<T>) {
  await transact<IDBValidKey>("readwrite", (store) => store.put(draft));
}

export async function deleteLocalDraft(key: string) {
  await transact<undefined>("readwrite", (store) => store.delete(key));
}

export function draftFingerprint(value: unknown) {
  return JSON.stringify(value);
}
