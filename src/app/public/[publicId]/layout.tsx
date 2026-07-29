import Link from "next/link";

import { QueryProvider } from "@/components/query-provider";

export const revalidate = 600;
export const dynamic = "force-static";

export default function PublicProjectLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueryProvider>
      <div className="flex min-h-svh flex-col bg-background lg:h-svh lg:overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b bg-card px-4 lg:px-6">
          <Link className="flex items-center gap-3" href="/">
            <span aria-hidden="true" className="size-3 bg-primary" />
            <span className="font-semibold tracking-tight">
              Chronology Studio
            </span>
          </Link>
          <span className="ml-auto text-sm text-muted-foreground">
            公開タイムライン
          </span>
        </header>
        <main className="styled-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto h-full w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </QueryProvider>
  );
}
