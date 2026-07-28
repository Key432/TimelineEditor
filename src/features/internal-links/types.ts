export type InternalLinkEntityType = "item" | "event";

export type InternalLinkCandidate = {
  entityType: InternalLinkEntityType;
  entityId: string;
  title: string;
  aliases: string[];
  kindLabel: string;
  dateLabel: string | null;
  parentTitle: string | null;
};

export type ResolvedInternalLink = Pick<
  InternalLinkCandidate,
  "entityType" | "entityId" | "title"
>;
