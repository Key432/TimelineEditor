import type { HistoricalDate } from "@/features/timeline-items/types";

export type TimelineBackgroundPeriod = {
  id: string;
  projectId: string;
  layerId: string;
  title: string;
  description: string | null;
  color: string;
  start: HistoricalDate;
  end: HistoricalDate;
  isStartApproximate: boolean;
  isEndApproximate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimelineBackgroundLayer = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  periods: TimelineBackgroundPeriod[];
  createdAt: string;
  updatedAt: string;
};
