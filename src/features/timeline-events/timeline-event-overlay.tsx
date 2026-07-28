"use client";

import { useRouter } from "next/navigation";
import { Maximize2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DetailOverlayCloseGuardContext,
  DetailOverlayControlsContext,
  DetailOverlayWidthContext,
} from "@/features/timeline-items/detail-overlay-close-guard";
import type { DetailWidth } from "@/features/timeline-items/detail-display-preferences";
import { cn } from "@/lib/utils";

export function TimelineEventOverlay({
  title,
  showTitle = false,
  children,
}: {
  title: string;
  showTitle?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [width, setWidth] = useState<DetailWidth>("normal");
  const [controls, setControls] = useState<HTMLDivElement | null>(null);
  return (
    <DetailOverlayWidthContext.Provider value={setWidth}>
      <DetailOverlayCloseGuardContext.Provider value={setDirty}>
        <Dialog
          open
          onOpenChange={(open) => {
            if (open) return;
            if (
              dirty &&
              !window.confirm("未保存の変更を破棄して閉じますか？")
            ) {
              return;
            }
            router.back();
          }}
        >
          <DialogContent
            className={cn(
              "max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0 transition-[max-width] duration-300 ease-out",
              width === "normal" && "sm:max-w-3xl",
              width === "wide" && "sm:max-w-5xl",
              width === "maximized" && "sm:max-w-[calc(100vw-2rem)]",
            )}
          >
            <div
              ref={setControls}
              className="absolute top-2 right-18 z-10 flex items-center"
              data-detail-overlay-controls="true"
            />
            <Button
              aria-label="全画面で表示"
              className="absolute top-2 right-10 z-10"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => window.location.assign(window.location.href)}
            >
              <Maximize2 aria-hidden="true" />
            </Button>
            <DialogTitle
              className={showTitle ? "px-8 pt-6 text-2xl" : "sr-only"}
            >
              {title}
            </DialogTitle>
            <DetailOverlayControlsContext.Provider value={controls}>
              <div className="styled-scrollbar min-h-0 overflow-y-auto">
                {children}
              </div>
            </DetailOverlayControlsContext.Provider>
          </DialogContent>
        </Dialog>
      </DetailOverlayCloseGuardContext.Provider>
    </DetailOverlayWidthContext.Provider>
  );
}
