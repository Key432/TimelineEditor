"use client";

import { useRouter } from "next/navigation";
import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0 sm:max-w-3xl">
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
        <DialogTitle className={showTitle ? "px-8 pt-8 text-2xl" : "sr-only"}>
          {title}
        </DialogTitle>
        <div className="styled-scrollbar min-h-0 overflow-y-auto">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
