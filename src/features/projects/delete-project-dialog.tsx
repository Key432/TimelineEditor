"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProject, projectKeys } from "@/features/projects/api";

export function DeleteProjectDialog({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const inputId = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => deleteProject(projectId, confirmationName),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      router.push("/projects");
      router.refresh();
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setConfirmationName("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden="true" className="size-4" />
          プロジェクトを完全削除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            プロジェクトを完全に削除しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。確認のため「{projectName}
            」と入力してください。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={inputId}>プロジェクト名</Label>
          <Input
            id={inputId}
            autoComplete="off"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
          />
          {mutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            キャンセル
          </AlertDialogCancel>
          <Button
            disabled={confirmationName !== projectName || mutation.isPending}
            onClick={() => mutation.mutate()}
            type="button"
            variant="destructive"
          >
            {mutation.isPending ? "削除中…" : "完全に削除"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
