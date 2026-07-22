"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CollapsibleProjectDescription({
  description,
}: {
  description: string;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () =>
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [description, expanded]);

  return (
    <div className="mt-1 flex max-w-4xl min-w-0 items-start gap-1">
      <p
        ref={textRef}
        className={cn(
          "min-w-0 text-sm whitespace-pre-wrap text-muted-foreground",
          !expanded && "line-clamp-1",
        )}
      >
        {description}
      </p>
      {overflowing || expanded ? (
        <Button
          aria-expanded={expanded}
          className="-my-1 h-7 shrink-0 px-2"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <ChevronUp aria-hidden="true" />
          ) : (
            <ChevronDown aria-hidden="true" />
          )}
          {expanded ? "閉じる" : "続きを読む"}
        </Button>
      ) : null}
    </div>
  );
}
