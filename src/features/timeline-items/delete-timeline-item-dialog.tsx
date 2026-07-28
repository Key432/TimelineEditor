"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { timelineEventKeys } from "@/features/timeline-events/api";
import {
  deleteTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";

export function DeleteTimelineItemDialog({
  projectId,
  itemId,
  title,
  redirectAfterDelete = false,
  closeOverlayAfterDelete = false,
}: {
  projectId: string;
  itemId: string;
  title: string;
  redirectAfterDelete?: boolean;
  closeOverlayAfterDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => deleteTimelineItem(projectId, itemId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: timelineItemKeys.list(projectId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: timelineEventKeys.list(projectId),
          exact: true,
        }),
      ]);
      setOpen(false);
      if (redirectAfterDelete) {
        if (closeOverlayAfterDelete) {
          router.back();
        } else {
          router.replace(`/projects/${projectId}/timeline`);
        }
      }
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden="true" className="size-4" />
          ゴミ箱へ移動
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            「{title}」をゴミ箱へ移動しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            ゴミ箱から復元できます。
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
