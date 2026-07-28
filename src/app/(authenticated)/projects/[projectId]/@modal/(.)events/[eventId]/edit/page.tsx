import { redirect } from "next/navigation";

export default async function LegacyTimelineEventEditModalPage({
  params,
}: {
  params: Promise<{ projectId: string; eventId: string }>;
}) {
  const { projectId, eventId } = await params;
  redirect(`/projects/${projectId}/events/${eventId}`);
}
