import Link from "next/link";
import { FolderKanban, LogOut, Menu, PanelLeftClose } from "lucide-react";

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

type AppShellProps = {
  children: React.ReactNode;
  email?: string;
  logoutAction?: () => Promise<void>;
};

function Navigation() {
  return (
    <nav aria-label="メインナビゲーション" className="space-y-1">
      <Link
        className="flex items-center gap-3 rounded-md bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-accent-foreground"
        href="/projects"
      >
        <FolderKanban aria-hidden="true" className="size-4" />
        プロジェクト
      </Link>
    </nav>
  );
}

export function AppShell({
  children,
  email,
  logoutAction = signOut,
}: AppShellProps) {
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
              <Navigation />
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

      <div className="mx-auto grid min-h-[calc(100svh-3.5rem)] w-full max-w-[1600px] lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r bg-sidebar p-4 lg:block">
          <div className="mb-5 flex items-center justify-between px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            ナビゲーション
            <PanelLeftClose aria-hidden="true" className="size-4" />
          </div>
          <Navigation />
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
