"use client";

import type { ReactElement } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TimelineEntityTooltip({
  children,
  title,
  date,
}: {
  children: ReactElement;
  title: string;
  date: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
