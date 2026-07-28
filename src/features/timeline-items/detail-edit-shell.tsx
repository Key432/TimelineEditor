"use client";

import { Maximize2, Pencil, Settings2, Shrink, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  DetailTypography,
  useDetailDisplayPreferences,
  type DetailFont,
  type DetailWidth,
} from "@/features/timeline-items/detail-display-preferences";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailEditorContext } from "@/features/timeline-items/detail-editor-context";
import {
  useDetailOverlayCloseGuard,
  useDetailOverlayControls,
  useDetailOverlayWidth,
} from "@/features/timeline-items/detail-overlay-close-guard";
import { cn } from "@/lib/utils";

export function DetailEditShell({
  children,
  editor,
  readOnly = false,
  placement = "page",
  preferenceKey,
}: {
  children: ReactNode;
  editor?: ReactNode;
  readOnly?: boolean;
  placement?: "page" | "overlay";
  preferenceKey: string;
}) {
  const { preferences, updatePreferences } =
    useDetailDisplayPreferences(preferenceKey);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const setOverlayDirty = useDetailOverlayCloseGuard();
  const setOverlayWidth = useDetailOverlayWidth();
  const overlayControls = useDetailOverlayControls();
  const { font, width } = preferences;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    setOverlayWidth?.(width);
  }, [setOverlayWidth, width]);

  function updateDirty(next: boolean) {
    setDirty(next);
    setOverlayDirty?.(next);
  }

  function stopEditing() {
    if (dirty && !window.confirm("未保存の変更を破棄しますか？")) return;
    updateDirty(false);
    setEditing(false);
  }

  const options = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="詳細オプション"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Settings2 aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>表示幅</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={width}
          onValueChange={(value) =>
            updatePreferences({ width: value as DetailWidth })
          }
        >
          <DropdownMenuRadioItem value="normal">通常</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="wide">
            <Shrink aria-hidden="true" />
            ワイド（左右の余白を縮小）
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="maximized">
            <Maximize2 aria-hidden="true" />
            最大化
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>書体</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={font}
          onValueChange={(value) =>
            updatePreferences({ font: value as DetailFont })
          }
        >
          <DropdownMenuRadioItem value="gothic">ゴシック</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="mincho">明朝</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {editing ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={stopEditing}>
              <X aria-hidden="true" />
              閲覧に戻る
            </DropdownMenuItem>
          </>
        ) : !readOnly && editor ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              編集
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className={cn(
        "mx-auto w-full transition-[max-width] duration-300 ease-out",
        width === "normal" && "max-w-3xl",
        width === "wide" && "max-w-[1400px]",
        width === "maximized" && "max-w-none",
      )}
      data-detail-mode={editing ? "edit" : "view"}
      data-detail-width={width}
    >
      {placement === "page" ? (
        <div className="absolute top-0 right-0 z-10">{options}</div>
      ) : overlayControls ? (
        createPortal(options, overlayControls)
      ) : null}
      {editing && editor ? (
        <DetailEditorContext.Provider
          value={{
            onDirtyChange: updateDirty,
            onSaved: () => {
              updateDirty(false);
              setEditing(false);
            },
          }}
        >
          <div className="rounded-xl bg-card px-6 py-8 ring-1 ring-foreground/10 sm:px-10">
            {editor}
          </div>
        </DetailEditorContext.Provider>
      ) : (
        <DetailTypography font={font}>{children}</DetailTypography>
      )}
    </div>
  );
}
