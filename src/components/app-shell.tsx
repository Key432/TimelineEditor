"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Menu, PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/features/auth/actions";
import { ProjectNavigation } from "@/features/projects/project-navigation";
import type { ProjectSummary } from "@/features/projects/types";

type AppShellProps = {
  children: React.ReactNode;
  email?: string;
  logoutAction?: () => Promise<void>;
  projects?: ProjectSummary[];
};

export function AppShell({
  children,
  email,
  logoutAction = signOut,
  projects = [],
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-card px-4 lg:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              aria-label="ナビゲーションを開く"
              className="mr-3 lg:hidden"
              size="icon"
              variant="ghost"
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader className="text-left">
              <SheetTitle>Chronology Studio</SheetTitle>
              <SheetDescription>プロジェクトのナビゲーション</SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <ProjectNavigation initialProjects={projects} />
            </div>
          </SheetContent>
        </Sheet>

        <Link className="flex items-center gap-3" href="/projects">
          <span aria-hidden="true" className="size-3 bg-primary" />
          <span className="font-semibold tracking-tight">
            Chronology Studio
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {email ? (
            <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
              {email}
            </span>
          ) : null}
          <form action={logoutAction}>
            <Button size="sm" type="submit" variant="outline">
              <LogOut aria-hidden="true" className="size-4" />
              ログアウト
            </Button>
          </form>
        </div>
      </header>

      <div
        className={`grid min-h-[calc(100svh-3.5rem)] w-full ${
          collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]"
        }`}
      >
        <aside
          className={`hidden border-r bg-sidebar lg:block ${collapsed ? "p-2" : "p-4"}`}
          aria-hidden={collapsed}
        >
          <div className="mb-5 flex items-center justify-between px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {!collapsed ? (
              <span>ナビゲーション</span>
            ) : (
              <span className="sr-only">ナビゲーション</span>
            )}
            <Button
              aria-label={
                collapsed ? "サイドパネルを開く" : "サイドパネルを折りたたむ"
              }
              size="icon"
              variant="ghost"
              onClick={() => setCollapsed((v) => !v)}
            >
              <PanelLeftClose aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className={collapsed ? "hidden" : ""}>
            <ProjectNavigation initialProjects={projects} />
          </div>
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
