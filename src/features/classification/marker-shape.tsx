import type { CSSProperties } from "react";
import type { MarkerShape } from "@/features/classification/types";
import { cn } from "@/lib/utils";

export function markerShapeStyle(shape: MarkerShape): CSSProperties {
  if (shape === "circle") return { borderRadius: "9999px" };
  if (shape === "square") return { borderRadius: "2px" };
  if (shape === "diamond")
    return { clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" };
  if (shape === "triangle")
    return { clipPath: "polygon(50% 0,100% 100%,0 100%)" };
  if (shape === "star")
    return {
      clipPath:
        "polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 100%,50% 74%,21% 100%,32% 57%,2% 35%,39% 35%)",
    };
  return { clipPath: "polygon(25% 7%,75% 7%,100% 50%,75% 93%,25% 93%,0 50%)" };
}

export function MarkerShapeIcon({
  shape,
  color,
  className,
}: {
  shape: MarkerShape;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 border border-black/15",
        className,
      )}
      style={{ ...markerShapeStyle(shape), backgroundColor: color }}
    />
  );
}

export function markerTextColor(color: string) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16)) ?? [0, 0, 0];
  return channels[0]! * 0.299 + channels[1]! * 0.587 + channels[2]! * 0.114 >
    160
    ? "#333333"
    : "#FFFFFF";
}
