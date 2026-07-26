"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

export function OperationBlockingOverlay({ message }: { message: string }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-label={message}
      aria-live="assertive"
      className="fixed inset-0 z-[100] grid cursor-wait place-items-center bg-background/80 p-6 backdrop-blur-sm"
      role="status"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Tab") event.preventDefault();
      }}
    >
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-lg">
        <LoaderCircle
          aria-hidden="true"
          className="size-5 animate-spin text-primary"
        />
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
}
