export type TimelineItemType = {
  id: string;
  projectId: string;
  name: string;
  defaultColor: string;
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
  isSystemSeed: boolean;
  createdAt: string;
  updatedAt: string;
};

export const ITEM_TYPE_ICON_OPTIONS = [
  "user-round",
  "brain",
  "sparkles",
  "newspaper",
  "users-round",
  "book-open",
  "image",
  "swords",
  "landmark",
  "gallery-horizontal",
  "circle-dot",
] as const;
