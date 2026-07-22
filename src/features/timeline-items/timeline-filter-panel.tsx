"use client";

import { RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimelineItemType } from "@/features/item-types/types";
import {
  DEFAULT_TIMELINE_FILTERS,
  type TimelineFilters,
} from "@/features/timeline-items/timeline-filters";

export function TimelineFilterPanel({
  filters,
  itemTypes,
  onChange,
}: {
  filters: TimelineFilters;
  itemTypes: TimelineItemType[];
  onChange: (filters: TimelineFilters) => void;
}) {
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const isComposing = useRef(false);
  const update = (values: Partial<TimelineFilters>) =>
    onChange({ ...filters, ...values });

  return (
    <div className="space-y-6 px-4 pb-6">
      <div className="space-y-2">
        <Label htmlFor="timeline-filter-query">タイムライン内検索</Label>
        <Input
          id="timeline-filter-query"
          placeholder="名称、本文、イベント、出典、対象種別"
          value={queryDraft}
          onChange={(event) => {
            const query = event.target.value;
            setQueryDraft(query);
            if (!isComposing.current) update({ query });
          }}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposing.current = false;
            update({ query: event.currentTarget.value });
          }}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">対象種別（複数選択）</legend>
        <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
          {itemTypes.map((type) => (
            <label key={type.id} className="flex items-center gap-2 text-sm">
              <input
                checked={filters.typeIds.includes(type.id)}
                className="size-4 accent-primary"
                type="checkbox"
                onChange={(event) =>
                  update({
                    typeIds: event.target.checked
                      ? [...filters.typeIds, type.id]
                      : filters.typeIds.filter((id) => id !== type.id),
                  })
                }
              />
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: type.defaultColor }}
              />
              {type.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">表示年代</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="timeline-filter-from" className="text-xs">
              開始年
            </Label>
            <Input
              id="timeline-filter-from"
              min={1}
              type="number"
              value={filters.fromYear ?? ""}
              onChange={(event) =>
                update({
                  fromYear: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timeline-filter-to" className="text-xs">
              終了年
            </Label>
            <Input
              id="timeline-filter-to"
              min={1}
              type="number"
              value={filters.toYear ?? ""}
              onChange={(event) =>
                update({
                  toYear: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect
          label="イベントアイテム"
          value={filters.hasEvents}
          options={[
            ["all", "指定なし"],
            ["yes", "あり"],
            ["no", "なし"],
          ]}
          onValueChange={(value) =>
            update({ hasEvents: value as TimelineFilters["hasEvents"] })
          }
        />
        <FilterSelect
          label="曖昧状態"
          value={filters.approximate}
          options={[
            ["all", "指定なし"],
            ["start", "開始・時点日"],
            ["end", "終了日"],
            ["any", "いずれか"],
            ["none", "曖昧なし"],
          ]}
          onValueChange={(value) =>
            update({ approximate: value as TimelineFilters["approximate"] })
          }
        />
        <FilterSelect
          label="個別色"
          value={filters.hasCustomColor}
          options={[
            ["all", "指定なし"],
            ["yes", "あり"],
            ["no", "なし"],
          ]}
          onValueChange={(value) =>
            update({
              hasCustomColor: value as TimelineFilters["hasCustomColor"],
            })
          }
        />
        <FilterSelect
          label="表示状態"
          value={filters.visibility}
          options={[
            ["all", "すべて"],
            ["visible", "表示"],
            ["hidden", "非表示"],
          ]}
          onValueChange={(value) =>
            update({ visibility: value as TimelineFilters["visibility"] })
          }
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">非一致の表示</legend>
        <div className="flex rounded-lg bg-muted p-1" role="group">
          <Button
            aria-pressed={filters.mode === "hide"}
            className="flex-1"
            size="sm"
            type="button"
            variant={filters.mode === "hide" ? "secondary" : "ghost"}
            onClick={() => update({ mode: "hide" })}
          >
            非表示
          </Button>
          <Button
            aria-pressed={filters.mode === "dim"}
            className="flex-1"
            size="sm"
            type="button"
            variant={filters.mode === "dim" ? "secondary" : "ghost"}
            onClick={() => update({ mode: "dim" })}
          >
            薄く表示
          </Button>
        </div>
      </fieldset>

      <Button
        className="w-full"
        type="button"
        variant="outline"
        onClick={() => {
          setQueryDraft(DEFAULT_TIMELINE_FILTERS.query);
          onChange(DEFAULT_TIMELINE_FILTERS);
        }}
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        フィルターをリセット
      </Button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([option, text]) => (
            <SelectItem key={option} value={option}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
