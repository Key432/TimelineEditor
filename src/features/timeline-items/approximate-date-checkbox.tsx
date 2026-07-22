import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function ApproximateDateCheckbox({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <label className="flex h-9 shrink-0 items-center gap-2 rounded-lg border bg-muted/20 px-3 text-sm font-normal">
      <input
        className={cn("size-4 accent-primary", className)}
        type="checkbox"
        {...props}
      />
      {label}
    </label>
  );
}
