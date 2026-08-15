import { localProjectBytes, normalizeLocalProject } from "./model";
import {
  LOCAL_PROJECT_DATABASE_NAME,
  LOCAL_PROJECT_DATABASE_VERSION,
  LOCAL_PROJECT_STORE_NAME,
  type LocalProjectRecord,
  type LocalStorageEstimate,
} from "./types";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      LOCAL_PROJECT_DATABASE_NAME,
      LOCAL_PROJECT_DATABASE_VERSION,
    );
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (event.oldVersion < 1) {
        const store = database.createObjectStore(LOCAL_PROJECT_STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("ローカル保存領域を開けませんでした。"),
      );
  });
}

async function request<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(LOCAL_PROJECT_STORE_NAME, mode);
      const result = operation(
        transaction.objectStore(LOCAL_PROJECT_STORE_NAME),
      );
      result.onsuccess = () => resolve(result.result);
      result.onerror = () =>
        reject(
          result.error ?? new Error("ローカルデータを処理できませんでした。"),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("ローカルデータを処理できませんでした。"),
        );
    });
  } finally {
    database.close();
  }
}

export async function listLocalProjects() {
  const values = await request<LocalProjectRecord[]>("readonly", (store) =>
    store.getAll(),
  );
  return values
    .map(normalizeLocalProject)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getLocalProject(id: string) {
  const value = await request<LocalProjectRecord | undefined>(
    "readonly",
    (store) => store.get(id),
  );
  return value ? normalizeLocalProject(value) : null;
}

export async function putLocalProject(project: LocalProjectRecord) {
  try {
    await request<IDBValidKey>("readwrite", (store) => store.put(project));
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new Error(
        "ブラウザの保存容量が不足しています。JSONまたはCSVで書き出してから不要なデータを整理してください。",
      );
    }
    throw error;
  }
}

export async function deleteLocalProject(id: string) {
  await request<undefined>("readwrite", (store) => store.delete(id));
}

export async function estimateLocalStorage(
  project: LocalProjectRecord,
): Promise<LocalStorageEstimate> {
  const estimate = await navigator.storage?.estimate?.();
  const usage = estimate?.usage ?? 0;
  const quota = estimate?.quota ?? 0;
  const projectBytes = localProjectBytes(project);
  return {
    usage,
    quota,
    projectBytes,
    isNearLimit: quota > 0 && (usage + projectBytes) / quota >= 0.9,
  };
}
