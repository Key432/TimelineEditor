"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getInternalLinkReferenceCount } from "@/features/internal-links/api";
import {
  deleteTimelineEvent,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import { useRegisterDetailOption } from "@/features/timeline-items/detail-options-context";
import { timelineItemKeys } from "@/features/timeline-items/api";

export function DeleteTimelineEventDialog({
  projectId,
  eventId,
  title,
  closeOverlayAfterDelete = false,
}: {
  projectId: string;
  eventId: string;
  title: string;
  closeOverlayAfterDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detailOption = useMemo(
    () => ({
      id: `trash-timeline-event-${eventId}`,
      label: "ゴミ箱へ移動",
      icon: Trash2,
      variant: "destructive" as const,
      onSelect: () => setOpen(true),
    }),
    [eventId],
  );
  useRegisterDetailOption(detailOption, true);
  const router = useRouter();
  const queryClient = useQueryClient();
  const referenceCount = useQuery({
    queryKey: ["projects", projectId, "internal-links", "event", eventId],
    queryFn: () => getInternalLinkReferenceCount(projectId, "event", eventId),
    enabled: open,
  });
  const mutation = useMutation({
    mutationFn: () => deleteTimelineEvent(projectId, eventId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: timelineEventKeys.list(projectId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: timelineItemKeys.list(projectId),
          exact: true,
        }),
      ]);
      setOpen(false);
      if (closeOverlayAfterDelete) router.back();
      else router.replace(`/projects/${projectId}/timeline`);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            「{title}」をゴミ箱へ移動しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            ゴミ箱から復元できます。
            {referenceCount.data
              ? ` このイベントは${referenceCount.data}件の本文から参照されています。移動後はリンク切れとして表示されます。`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.error ? (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "移動中…" : "ゴミ箱へ移動"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
