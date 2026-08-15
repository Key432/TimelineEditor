import { redirect } from "next/navigation";

import { QueryProvider } from "@/components/query-provider";
import { LocalHome } from "@/features/local-projects/local-home";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) redirect("/projects");

  return (
    <QueryProvider>
      <LocalHome />
    </QueryProvider>
  );
}
