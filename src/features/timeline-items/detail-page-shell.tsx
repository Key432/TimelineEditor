"use client";

import { ChevronsLeftRight, Rows3 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DetailPageShell({
  projectId,
  projectName,
  title,
  returnTo,
  breadcrumbParent,
  children,
}: {
  projectId: string;
  projectName: string;
  title: string;
  returnTo: string | null;
  breadcrumbParent?: { href: string; label: string };
  children: ReactNode;
}) {
  const [wide, setWide] = useState(false);

  function toggleWide() {
    setWide((current) => !current);
  }

  return (
    <div
      className={cn(
        "mx-auto w-full space-y-4",
        wide ? "max-w-[1400px]" : "max-w-5xl",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav
          aria-label="パンくず"
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
        >
          {returnTo ? (
            <>
              <Link className="hover:text-foreground" href={returnTo}>
                検索結果
              </Link>
              <span aria-hidden="true">/</span>
            </>
          ) : null}
          <Link
            className="truncate hover:text-foreground"
            href={breadcrumbParent?.href ?? `/projects/${projectId}/timeline`}
          >
            {breadcrumbParent?.label ?? projectName}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground" aria-current="page">
            {title}
          </span>
        </nav>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/projects/${projectId}/timeline`}>
              <Rows3 aria-hidden="true" />
              タイムラインを表示
            </Link>
          </Button>
          <Button
            aria-pressed={wide}
            size="sm"
            type="button"
            variant="outline"
            onClick={toggleWide}
          >
            <ChevronsLeftRight aria-hidden="true" />
            左右の余白を縮小
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
