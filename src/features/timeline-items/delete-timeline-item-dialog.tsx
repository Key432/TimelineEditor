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
  childEventCount = 0,
  redirectAfterDelete = false,
  closeOverlayAfterDelete = false,
}: {
  projectId: string;
  itemId: string;
  title: string;
  childEventCount?: number;
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
          完全削除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>「{title}」を完全削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。
            {childEventCount > 0
              ? ` 紐づくイベントアイテム${childEventCount}件も完全に削除されます。`
              : " 紐づくイベントアイテムはありません。"}
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
            {mutation.isPending ? "削除中…" : "完全削除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
