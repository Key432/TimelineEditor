"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogTitle className={showTitle ? "px-8 pt-8 text-2xl" : "sr-only"}>
          {title}
        </DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
