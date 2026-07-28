import Link from "next/link";

export const dynamic = "force-static";

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            className="flex items-center gap-3 font-semibold tracking-tight"
            href="/"
          >
            <span aria-hidden="true" className="size-3 bg-primary" />
            Chronology Studio
          </Link>
          <Link
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/help"
          >
            ヘルプ
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {children}
      </main>
    </div>
  );
}
