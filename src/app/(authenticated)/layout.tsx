import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/components/query-provider";
import { ProjectService } from "@/lib/services/project-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : undefined;
  const projects = await new ProjectService(supabase).list();

  return (
    <QueryProvider>
      <AppShell email={email} projects={projects}>
        {children}
      </AppShell>
    </QueryProvider>
  );
}
