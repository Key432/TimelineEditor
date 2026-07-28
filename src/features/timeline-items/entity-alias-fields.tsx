import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EntityAliasFields({
  id,
  aliases,
  error,
  onChange,
}: {
  id: string;
  aliases: string[];
  error?: string;
  onChange: (aliases: string[]) => void;
}) {
  return (
    <details
      className="group rounded-lg border bg-muted/15"
      data-slot="entity-aliases"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span>別名（任意）</span>
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {error
            ? "入力を確認"
            : aliases.length
              ? `${aliases.length}件`
              : "未設定"}
        </span>
        <span className="transition-transform group-open:rotate-180">
          <ChevronDown aria-hidden="true" className="size-4" />
        </span>
      </summary>
      <div className="space-y-2 border-t px-3 py-3">
        <Label htmlFor={id}>別名</Label>
        <Input
          id={id}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          aria-invalid={Boolean(error)}
          placeholder="原語名、旧名、筆名など（読点区切り）"
          value={aliases.join("、")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(/[、,\n]/)
                .map((alias) => alias.trim())
                .filter(Boolean),
            )
          }
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          複数ある場合は読点で区切ります。検索と内部リンク候補に使われます。
        </p>
        {error ? (
          <p
            id={`${id}-error`}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
