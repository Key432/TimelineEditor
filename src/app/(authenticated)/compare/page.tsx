import { Suspense } from "react";

import { ComparisonPageClient } from "@/features/comparison/comparison-page-client";
import { ComparisonService } from "@/lib/services/comparison-service";
import { createClient } from "@/lib/supabase/server";

export default async function ComparisonPage() {
  const service = new ComparisonService(await createClient());
  const [projects, views] = await Promise.all([
    service.listProjects(),
    service.listSavedViews(),
  ]);
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border p-8 text-muted-foreground">
          比較条件を読み込んでいます…
        </div>
      }
    >
      <ComparisonPageClient initialViews={views} projects={projects} />
    </Suspense>
  );
}
