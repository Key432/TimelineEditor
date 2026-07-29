"use client";

import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import { useClickOutside } from "@/hooks/use-click-outside";

export function TimelineParentSelect({
  rangeItems,
  value,
  onChange,
}: {
  rangeItems: TimelineItemSummary[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useClickOutside(containerRef, () => setOpen(false));
  const selected = value.flatMap((id) => {
    const item = rangeItems.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });
  const filtered = rangeItems.filter((item) =>
    item.title
      .toLocaleLowerCase("ja")
      .includes(query.trim().toLocaleLowerCase("ja")),
  );

  return (
    <div ref={containerRef} className="space-y-2">
      <Label>親タイムラインアイテム</Label>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap gap-1.5 rounded-md border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
          {selected.map((item, index) => (
            <span
              key={item.id}
              className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
            >
              <span>{item.title}</span>
              <button
                aria-label={`${item.title}を前へ移動`}
                disabled={index === 0}
                type="button"
                onClick={() => {
                  const next = [...value];
                  [next[index - 1], next[index]] = [
                    next[index]!,
                    next[index - 1]!,
                  ];
                  onChange(next);
                }}
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                aria-label={`${item.title}を後ろへ移動`}
                disabled={index === value.length - 1}
                type="button"
                onClick={() => {
                  const next = [...value];
                  [next[index], next[index + 1]] = [
                    next[index + 1]!,
                    next[index]!,
                  ];
                  onChange(next);
                }}
              >
                <ArrowDown className="size-3" />
              </button>
              <button
                aria-label={`${item.title}を外す`}
                type="button"
                onClick={() => onChange(value.filter((id) => id !== item.id))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-label="親タイムラインアイテムを検索"
            className="min-w-36 flex-1 bg-transparent px-1 text-sm outline-none"
            placeholder={selected.length ? "親を追加" : "検索して選択"}
            role="combobox"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          />
        </div>
        {open ? (
          <div
            id={listboxId}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl"
          >
            <p className="px-2 py-1 text-xs text-muted-foreground">
              親タイムラインアイテムを複数選択できます
            </p>
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  type="button"
                  onClick={() => {
                    onChange(
                      value.includes(item.id)
                        ? value.filter((id) => id !== item.id)
                        : [...value, item.id],
                    );
                    setQuery("");
                  }}
                >
                  <span className="truncate">{item.title}</span>
                  {value.includes(item.id) ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                一致する候補はありません。
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
