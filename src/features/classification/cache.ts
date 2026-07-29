import type { QueryClient } from "@tanstack/react-query";

import { classificationKeys } from "@/features/classification/api";
import { timelineEventKeys } from "@/features/timeline-events/api";

export function invalidateEventTypeDependents(
  queryClient: QueryClient,
  projectId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: classificationKeys.all(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: timelineEventKeys.list(projectId),
    }),
  ]);
}
