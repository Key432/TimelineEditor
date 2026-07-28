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
    <div className="space-y-2">
      <Label htmlFor={id}>別名</Label>
      <Input
        id={id}
        aria-describedby={`${id}-hint`}
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
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
