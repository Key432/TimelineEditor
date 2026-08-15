"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { CircleHelp, LogOut, Menu, PanelLeftClose } from "lucide-react";

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
import { GlobalSearch } from "@/features/search/global-search";

type AppShellProps = {
  children: React.ReactNode;
  email?: string;
  logoutAction?: () => Promise<void>;
  projects?: ProjectSummary[];
};

const SIDEBAR_COLLAPSED_KEY = "timeline-editor:sidebar-collapsed:v1";
const SIDEBAR_PREFERENCE_EVENT = "timeline-editor:sidebar-preference";

function subscribeSidebarPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_PREFERENCE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, callback);
  };
}

function sidebarPreferenceSnapshot() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppShell({
  children,
  email,
  logoutAction = signOut,
  projects = [],
}: AppShellProps) {
  const collapsed = useSyncExternalStore(
    subscribeSidebarPreference,
    sidebarPreferenceSnapshot,
    () => false,
  );
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  function toggleSidebar() {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!collapsed));
      window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_EVENT));
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }
  return (
    <div className="min-h-svh bg-background lg:h-svh lg:overflow-hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-card px-4 lg:px-6">
        <Sheet
          open={mobileNavigationOpen}
          onOpenChange={setMobileNavigationOpen}
        >
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
              <ProjectNavigation
                initialProjects={projects}
                onNavigate={() => setMobileNavigationOpen(false)}
              />
              <Link
                className="mt-5 flex items-center gap-2 border-t pt-4 text-sm font-medium text-muted-foreground hover:text-foreground"
                href="/help"
                onClick={() => setMobileNavigationOpen(false)}
              >
                <CircleHelp aria-hidden="true" className="size-4" />
                ヘルプ
              </Link>
            </div>
          </SheetContent>
        </Sheet>

        <Link className="flex items-center gap-3" href="/projects">
          <span aria-hidden="true" className="size-3 bg-primary" />
          <span className="font-semibold tracking-tight">
            Chronology Studio
          </span>
        </Link>

        <GlobalSearch />

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
        className={`grid min-h-[calc(100svh-3.5rem)] w-full lg:h-[calc(100svh-3.5rem)] lg:min-h-0 ${
          collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]"
        }`}
      >
        <aside
          className={`hidden h-full flex-col border-r bg-sidebar lg:flex ${collapsed ? "p-2" : "p-4"}`}
          data-collapsed={collapsed}
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
              onClick={toggleSidebar}
            >
              <PanelLeftClose aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className={collapsed ? "hidden" : "min-h-0 flex-1"}>
            <ProjectNavigation initialProjects={projects} />
          </div>
          <Link
            aria-label={collapsed ? "ヘルプ" : undefined}
            className={`mt-auto flex items-center rounded-md text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              collapsed ? "justify-center p-2" : "gap-2 border-t px-2 pt-4"
            }`}
            href="/help"
          >
            <CircleHelp aria-hidden="true" className="size-4 shrink-0" />
            {collapsed ? <span className="sr-only">ヘルプ</span> : "ヘルプ"}
          </Link>
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:p-6">
          <div className="mx-auto h-full w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
