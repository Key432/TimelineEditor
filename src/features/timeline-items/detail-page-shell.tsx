"use client";

import { ChevronDown, Rows3 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DetailPageShell({
  projectId,
  projectName,
  title,
  returnTo,
  breadcrumbParent,
  breadcrumbParents,
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
  breadcrumbParents?: {
    href: string;
    label: string;
    hardNavigation?: boolean;
  }[];
  children: ReactNode;
  timelineHref?: string;
}) {
  const singleBreadcrumbParent = breadcrumbParents?.[0] ?? breadcrumbParent;

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
          {breadcrumbParents && breadcrumbParents.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="親タイムラインアイテムを選択"
                  className="h-auto max-w-64 gap-1 px-1 py-0 font-normal text-muted-foreground hover:text-foreground"
                  variant="ghost"
                >
                  {breadcrumbParents.length}件の親タイムラインアイテム
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-64">
                <DropdownMenuLabel>移動先を選択</DropdownMenuLabel>
                {breadcrumbParents.map((parent) => (
                  <DropdownMenuItem key={parent.href} asChild>
                    {parent.hardNavigation ? (
                      <a href={parent.href}>{parent.label}</a>
                    ) : (
                      <Link href={parent.href}>{parent.label}</Link>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : singleBreadcrumbParent?.hardNavigation ? (
            <a
              className="truncate hover:text-foreground"
              href={singleBreadcrumbParent.href}
            >
              {singleBreadcrumbParent.label}
            </a>
          ) : (
            <Link
              className="truncate hover:text-foreground"
              href={
                singleBreadcrumbParent?.href ??
                timelineHref ??
                `/projects/${projectId}/timeline`
              }
            >
              {singleBreadcrumbParent?.label ?? projectName}
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
