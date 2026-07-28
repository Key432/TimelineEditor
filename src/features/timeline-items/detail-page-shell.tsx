"use client";

import { Rows3 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function DetailPageShell({
  projectId,
  projectName,
  title,
  returnTo,
  breadcrumbParent,
  children,
  timelineHref,
}: {
  projectId: string;
  projectName: string;
  title: string;
  returnTo: string | null;
  breadcrumbParent?: {
    href: string;
    label: string;
    hardNavigation?: boolean;
  };
  children: ReactNode;
  timelineHref?: string;
}) {
  return (
    <div className="detail-page-shell relative mx-auto w-full max-w-none space-y-4">
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
          {breadcrumbParent?.hardNavigation ? (
            <a
              className="truncate hover:text-foreground"
              href={breadcrumbParent.href}
            >
              {breadcrumbParent.label}
            </a>
          ) : (
            <Link
              className="truncate hover:text-foreground"
              href={
                breadcrumbParent?.href ??
                timelineHref ??
                `/projects/${projectId}/timeline`
              }
            >
              {breadcrumbParent?.label ?? projectName}
            </Link>
          )}
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground" aria-current="page">
            {title}
          </span>
        </nav>
        <div className="mr-10 flex items-center gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link href={timelineHref ?? `/projects/${projectId}/timeline`}>
              <Rows3 aria-hidden="true" />
              タイムラインを表示
            </Link>
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
