import { revalidatePath } from "next/cache";

import type { Project } from "@/features/projects/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ProjectService } from "@/lib/services/project-service";

export function revalidatePublicProject(
  project: Pick<Project, "visibility" | "publicId">,
) {
  if (project.visibility !== "public" || !project.publicId) return;
  revalidatePath(`/public/${project.publicId}`);
  revalidatePath("/public/[publicId]/items/[itemId]", "page");
  revalidatePath("/public/[publicId]/events/[eventId]", "page");
}

export async function revalidatePublicProjectById(
  client: SupabaseClient<Database>,
  projectId: string,
) {
  revalidatePublicProject(await new ProjectService(client).get(projectId));
}
