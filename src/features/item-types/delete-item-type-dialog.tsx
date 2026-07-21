"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import { deleteItemType, itemTypeKeys } from "@/features/item-types/api";

type DeleteItemTypeDialogProps = {
  projectId: string;
  typeId: string;
  typeName: string;
};

export function DeleteItemTypeDialog({
  projectId,
  typeId,
  typeName,
}: DeleteItemTypeDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => deleteItemType(projectId, typeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: itemTypeKeys.list(projectId),
      });
      setOpen(false);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button aria-label={`${typeName}を削除`} size="icon" variant="ghost">
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>「{typeName}」を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。タイムラインアイテムで使用中の場合は削除されません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.error ? (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "削除中…" : "削除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
