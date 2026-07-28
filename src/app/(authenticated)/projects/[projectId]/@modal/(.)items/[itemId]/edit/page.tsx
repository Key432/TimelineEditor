import { redirect } from "next/navigation";

export default async function LegacyTimelineItemEditModalPage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;
  redirect(`/projects/${projectId}/items/${itemId}`);
}
