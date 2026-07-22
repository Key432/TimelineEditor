"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Link2Off, RefreshCw } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  projectKeys,
  publishProject,
  regenerateProjectPublicId,
  unpublishProject,
} from "@/features/projects/api";
import type { Project } from "@/features/projects/types";

const subscribeToOrigin = () => () => undefined;

export function ProjectSharing({
  project: initialProject,
  onChanged,
}: {
  project: Project;
  onChanged?: (project: Project) => void;
}) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState(initialProject);
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    () => window.location.origin,
    () => "",
  );
  const publicPath = project.publicId ? `/public/${project.publicId}` : null;
  const publicUrl = publicPath ? `${origin}${publicPath}` : "";

  const mutation = useMutation({
    mutationFn: (action: "publish" | "unpublish" | "regenerate") => {
      if (action === "publish") return publishProject(project.id);
      if (action === "unpublish") return unpublishProject(project.id);
      return regenerateProjectPublicId(project.id);
    },
    onSuccess: async (nextProject) => {
      setProject(nextProject);
      setCopied(false);
      queryClient.setQueryData(projectKeys.detail(project.id), nextProject);
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      onChanged?.(nextProject);
    },
  });

  async function copyUrl() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">公開状態</p>
          <p className="text-sm text-muted-foreground">
            公開すると、共有URLを知っている人が認証なしで閲覧できます。
          </p>
        </div>
        <Badge
          variant={project.visibility === "public" ? "secondary" : "outline"}
        >
          {project.visibility === "public" ? "公開中" : "非公開"}
        </Badge>
      </div>

      {project.visibility === "public" && publicPath ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="project-public-url">
            共有URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="project-public-url" readOnly value={publicUrl} />
            <Button type="button" variant="outline" onClick={copyUrl}>
              <Copy aria-hidden="true" />
              {copied ? "コピー済み" : "コピー"}
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={publicPath} rel="noreferrer" target="_blank">
                <ExternalLink aria-hidden="true" />
                別タブで表示
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {mutation.error ? (
        <p className="text-sm text-destructive" role="alert">
          {mutation.error.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {project.visibility === "private" ? (
          <ConfirmAction
            description="タイムラインと詳細を、共有URLから誰でも閲覧できるようにします。noindexは検索結果への掲載を抑制しますが、アクセス制御ではありません。"
            disabled={mutation.isPending}
            label="公開する"
            title="プロジェクトを公開しますか？"
            onConfirm={() => mutation.mutate("publish")}
          >
            <Link2 aria-hidden="true" />
            公開する
          </ConfirmAction>
        ) : (
          <ConfirmAction
            description="共有URLからの匿名閲覧を直ちに停止します。同じURLは再公開時に再利用されます。"
            disabled={mutation.isPending}
            label="非公開にする"
            title="プロジェクトを非公開にしますか？"
            onConfirm={() => mutation.mutate("unpublish")}
          >
            <Link2Off aria-hidden="true" />
            非公開にする
          </ConfirmAction>
        )}
        {project.publicId ? (
          <ConfirmAction
            description="現在の共有URLは直ちに無効になります。この操作は取り消せません。"
            disabled={mutation.isPending}
            label="URLを再発行"
            title="共有URLを再発行しますか？"
            variant="destructive"
            onConfirm={() => mutation.mutate("regenerate")}
          >
            <RefreshCw aria-hidden="true" />
            URLを再発行
          </ConfirmAction>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmAction({
  title,
  description,
  label,
  disabled,
  variant = "default",
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  label: string;
  disabled: boolean;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} type="button" variant={variant}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
