"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  formatHistoricalDate,
  HISTORICAL_PRECISION_LABELS,
} from "@/features/timeline-items/historical-date";
import type { HistoricalDatePrecision } from "@/features/timeline-items/types";

const selectClassName =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function HistoricalDateFields({
  id,
  precision,
  value,
  eraRegistration,
  precisionRegistration,
  yearRegistration,
  monthRegistration,
  dayRegistration,
  originalTextRegistration,
  labelPrefix = "",
}: {
  id: string;
  precision: HistoricalDatePrecision;
  value?: {
    era?: "ce" | "bce";
    year?: string | number | null;
    month?: string | number | null;
    day?: string | number | null;
    originalText?: string | null;
  };
  eraRegistration: UseFormRegisterReturn;
  precisionRegistration: UseFormRegisterReturn;
  yearRegistration: UseFormRegisterReturn;
  monthRegistration: UseFormRegisterReturn;
  dayRegistration: UseFormRegisterReturn;
  originalTextRegistration: UseFormRegisterReturn;
  labelPrefix?: string;
}) {
  const showsMonth = precision === "month" || precision === "day";
  const showsDay = precision === "day";
  const numericYear = Number(value?.year);
  const preview =
    Number.isInteger(numericYear) && numericYear >= 1
      ? formatHistoricalDate({
          era: value?.era ?? "ce",
          precision,
          year: numericYear,
          month: showsMonth && value?.month ? Number(value.month) : null,
          day: showsDay && value?.day ? Number(value.day) : null,
          originalText: value?.originalText || null,
          calendar: "proleptic_gregorian",
        })
      : null;

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[7rem_8rem_minmax(7.5rem,10rem)_4.5rem_4.5rem]">
        <select
          aria-label={`${labelPrefix}時代`}
          className={selectClassName}
          {...eraRegistration}
        >
          <option value="ce">西暦</option>
          <option value="bce">紀元前</option>
        </select>
        <select
          aria-label={`${labelPrefix}日付精度`}
          className={selectClassName}
          {...precisionRegistration}
        >
          {Object.entries(HISTORICAL_PRECISION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <Input
          id={id}
          aria-label={`${labelPrefix}${precision === "century" ? "世紀" : precision === "decade" ? "年代" : "年"}`}
          inputMode="numeric"
          min={1}
          placeholder={
            precision === "century"
              ? "世紀"
              : precision === "decade"
                ? "年代（1860）"
                : "年"
          }
          type="number"
          {...yearRegistration}
        />
        {showsMonth ? (
          <Input
            aria-label={`${labelPrefix}月`}
            inputMode="numeric"
            max={12}
            min={1}
            placeholder="月"
            type="number"
            {...monthRegistration}
          />
        ) : (
          <span aria-hidden="true" />
        )}
        {showsDay ? (
          <Input
            aria-label={`${labelPrefix}日`}
            inputMode="numeric"
            max={31}
            min={1}
            placeholder="日"
            type="number"
            {...dayRegistration}
          />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <Input
        aria-label={`${labelPrefix}原資料上の日付表記`}
        placeholder="原資料上の表記（任意）"
        {...originalTextRegistration}
      />
      {preview ? (
        <p className="text-xs text-muted-foreground">
          表記プレビュー: {preview}
        </p>
      ) : null}
    </div>
  );
}
