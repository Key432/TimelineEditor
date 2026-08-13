import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import type {
  NetworkEdge,
  NetworkNode,
} from "@/features/relationship-network/network-model";

export const NETWORK_NODE_MIN_WIDTH = 172;
export const NETWORK_NODE_MAX_WIDTH = 250;
export const NETWORK_NODE_HEIGHT = 76;
export const NETWORK_CLUSTER_WIDTH = 188;
export const NETWORK_CLUSTER_HEIGHT = 64;
export const NETWORK_NODE_TEXT_INSET = 18;
export const NETWORK_NODE_TEXT_RIGHT_PADDING = 12;
const NETWORK_TITLE_FONT_SIZE = 14;
const NETWORK_SUBTITLE_FONT_SIZE = 10.5;
const ELLIPSIS = "…";

export type PositionedNetworkNode = NetworkNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ForceNode = SimulationNodeDatum & {
  id: string;
  node: NetworkNode;
  width: number;
  height: number;
};

type ForceLink = SimulationLinkDatum<ForceNode> & { edge: NetworkEdge };

function stableSeed(value: string) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    seed ^= value.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function initialPoint(id: string, index: number, count: number) {
  const seed = stableSeed(id);
  const angle =
    index * Math.PI * (3 - Math.sqrt(5)) + ((seed % 360) * Math.PI) / 180;
  const radius = 36 * Math.sqrt(Math.max(1, index)) + Math.sqrt(count) * 12;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function glyphWidth(character: string, fontSize: number) {
  if (/\s/u.test(character)) return fontSize * 0.35;
  const codePoint = character.codePointAt(0) ?? 0;
  if (
    codePoint >= 0x1100 ||
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    codePoint > 0xffff
  )
    return fontSize;
  if (/[A-Z0-9]/u.test(character)) return fontSize * 0.62;
  return fontSize * 0.54;
}

export function measureNetworkText(text: string, fontSize: number) {
  return Array.from(text).reduce(
    (width, character) => width + glyphWidth(character, fontSize),
    0,
  );
}

export function networkNodeWidth(node: NetworkNode) {
  if (node.kind === "cluster") return NETWORK_CLUSTER_WIDTH;
  const desired =
    measureNetworkText(node.title, NETWORK_TITLE_FONT_SIZE) +
    NETWORK_NODE_TEXT_INSET +
    NETWORK_NODE_TEXT_RIGHT_PADDING;
  return Math.min(
    NETWORK_NODE_MAX_WIDTH,
    Math.max(NETWORK_NODE_MIN_WIDTH, Math.ceil(desired)),
  );
}

function fittingPrefix(text: string, maxWidth: number, fontSize: number) {
  const characters = Array.from(text);
  let width = 0;
  let length = 0;
  for (const character of characters) {
    const nextWidth = width + glyphWidth(character, fontSize);
    if (nextWidth > maxWidth) break;
    width = nextWidth;
    length += 1;
  }
  return characters.slice(0, length).join("");
}

export function wrapNetworkTitle(title: string, nodeWidth: number) {
  const available =
    nodeWidth - NETWORK_NODE_TEXT_INSET - NETWORK_NODE_TEXT_RIGHT_PADDING;
  if (measureNetworkText(title, NETWORK_TITLE_FONT_SIZE) <= available)
    return [title];

  const first = fittingPrefix(title, available, NETWORK_TITLE_FONT_SIZE);
  const remaining = Array.from(title).slice(Array.from(first).length).join("");
  if (measureNetworkText(remaining, NETWORK_TITLE_FONT_SIZE) <= available)
    return [first.trimEnd(), remaining.trimStart()];

  const lastAvailable =
    available - measureNetworkText(ELLIPSIS, NETWORK_TITLE_FONT_SIZE);
  return [
    first.trimEnd(),
    `${fittingPrefix(remaining.trimStart(), lastAvailable, NETWORK_TITLE_FONT_SIZE).trimEnd()}${ELLIPSIS}`,
  ];
}

export function truncateNetworkSubtitle(subtitle: string, nodeWidth: number) {
  const available =
    nodeWidth - NETWORK_NODE_TEXT_INSET - NETWORK_NODE_TEXT_RIGHT_PADDING;
  if (measureNetworkText(subtitle, NETWORK_SUBTITLE_FONT_SIZE) <= available)
    return subtitle;
  const text = fittingPrefix(
    subtitle,
    available - measureNetworkText(ELLIPSIS, NETWORK_SUBTITLE_FONT_SIZE),
    NETWORK_SUBTITLE_FONT_SIZE,
  );
  return `${text.trimEnd()}${ELLIPSIS}`;
}

export function layoutNetwork(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
): PositionedNetworkNode[] {
  const forceNodes: ForceNode[] = nodes.map((node, index) => {
    const size = {
      width: networkNodeWidth(node),
      height:
        node.kind === "cluster" ? NETWORK_CLUSTER_HEIGHT : NETWORK_NODE_HEIGHT,
    };
    return {
      id: node.id,
      node,
      ...size,
      ...initialPoint(node.id, index, nodes.length),
    };
  });
  const available = new Set(forceNodes.map((node) => node.id));
  const links: ForceLink[] = edges
    .filter((edge) => available.has(edge.source) && available.has(edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target, edge }));
  const simulation = forceSimulation(forceNodes)
    .randomSource(() => 0.5)
    .alphaDecay(0.035)
    .velocityDecay(0.45)
    .force(
      "link",
      forceLink<ForceNode, ForceLink>(links)
        .id((node) => node.id)
        .distance(190)
        .strength(0.55),
    )
    .force("charge", forceManyBody().strength(-620).distanceMax(720))
    .force("center", forceCenter(0, 0).strength(0.08))
    .force("x", forceX(0).strength(0.025))
    .force("y", forceY(0).strength(0.025))
    .force(
      "collision",
      forceCollide<ForceNode>()
        .radius((node) => Math.hypot(node.width / 2, node.height / 2) + 18)
        .strength(1)
        .iterations(3),
    )
    .stop();
  for (let index = 0; index < 240; index += 1) simulation.tick();
  return forceNodes.map((node) => ({
    ...node.node,
    x: Number((node.x ?? 0).toFixed(2)),
    y: Number((node.y ?? 0).toFixed(2)),
    width: node.width,
    height: node.height,
  }));
}

export function layoutBounds(nodes: PositionedNetworkNode[], padding = 80) {
  if (nodes.length === 0)
    return {
      minX: -padding,
      minY: -padding,
      width: padding * 2,
      height: padding * 2,
    };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function networkEdgePath(
  source: PositionedNetworkNode,
  target: PositionedNetworkNode,
  offset = 0,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const sourceScale = Math.min(
    Math.abs(source.width / 2 / (dx || 0.0001)),
    Math.abs(source.height / 2 / (dy || 0.0001)),
  );
  const targetScale = Math.min(
    Math.abs(target.width / 2 / (dx || 0.0001)),
    Math.abs(target.height / 2 / (dy || 0.0001)),
  );
  const start = {
    x: source.x + dx * sourceScale,
    y: source.y + dy * sourceScale,
  };
  const end = {
    x: target.x - dx * targetScale,
    y: target.y - dy * targetScale,
  };
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const control = {
    x: (start.x + end.x) / 2 + normalX * offset,
    y: (start.y + end.y) / 2 + normalY * offset,
  };
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
}
