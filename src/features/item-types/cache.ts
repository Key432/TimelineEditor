import type { QueryClient } from "@tanstack/react-query";

import { itemTypeKeys } from "@/features/item-types/api";
import { timelineItemKeys } from "@/features/timeline-items/api";

export function invalidateItemTypeDependents(
  queryClient: QueryClient,
  projectId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: itemTypeKeys.list(projectId) }),
    queryClient.invalidateQueries({
      queryKey: timelineItemKeys.list(projectId),
    }),
  ]);
}
