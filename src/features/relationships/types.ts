export const RELATIONSHIP_ENTITY_TYPES = [
  "timeline_item",
  "timeline_event",
] as const;
export type RelationshipEntityType = (typeof RELATIONSHIP_ENTITY_TYPES)[number];

export const DEFAULT_RELATIONSHIP_TYPES = [
  "影響",
  "参照",
  "協働",
  "師弟",
  "対立",
  "継承",
  "その他",
] as const;

export const RELATIONSHIP_LINE_STYLES = ["single", "double"] as const;
export type RelationshipLineStyle = (typeof RELATIONSHIP_LINE_STYLES)[number];

export const RELATIONSHIP_MARKERS = ["none", "arrow"] as const;
export type RelationshipMarker = (typeof RELATIONSHIP_MARKERS)[number];

export type RelationshipEntityOption = {
  type: RelationshipEntityType;
  id: string;
  title: string;
};

export type EntityRelationship = {
  id: string;
  projectId: string;
  sourceType: RelationshipEntityType;
  sourceId: string;
  targetType: RelationshipEntityType;
  targetId: string;
  relationType: string;
  direction: "directed" | "undirected";
  lineStyle: RelationshipLineStyle;
  sourceMarker: RelationshipMarker;
  targetMarker: RelationshipMarker;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RelationshipDataset = {
  relationships: EntityRelationship[];
  entities: RelationshipEntityOption[];
};
