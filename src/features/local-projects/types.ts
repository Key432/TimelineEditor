import type { ProjectBackup } from "@/features/import-export/schema";

export const LOCAL_PROJECT_DATABASE_NAME = "chronology-studio-local";
export const LOCAL_PROJECT_DATABASE_VERSION = 1;
export const LOCAL_PROJECT_STORE_NAME = "projects";

export type LocalProjectRecord = {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  backup: ProjectBackup;
};

export type LocalStorageEstimate = {
  usage: number;
  quota: number;
  projectBytes: number;
  isNearLimit: boolean;
};
