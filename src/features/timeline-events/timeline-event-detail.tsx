"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  deleteTimelineEvent,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import type { TimelineEvent } from "@/features/timeline-events/types";
import { formatHistoricalDate } from "@/features/timeline-items/historical-date";

function DetailText({ value }: { value: string | null }) {
  return value ? (
    <p className="whitespace-pre-wrap">{value}</p>
  ) : (
    <p className="text-muted-foreground">—</p>
  );
}

function SourceText({ value }: { value: string | null }) {
  if (!value) return <p className="text-muted-foreground">—</p>;
  return (
    <p className="whitespace-pre-wrap">
      {value.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
        if (!part.startsWith("http://") && !part.startsWith("https://")) {
          return part;
        }
        try {
          const url = new URL(part);
          return (
            <a
              key={`${url.href}-${index}`}
              className="text-primary underline"
              href={url.href}
              rel="noreferrer"
              target="_blank"
            >
              {part}
            </a>
          );
        } catch {
          return part;
        }
      })}
    </p>
  );
}

export function TimelineEventDetail({
  projectId,
  event,
  readOnly = false,
}: {
  projectId: string;
  event: TimelineEvent;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deletion = useMutation({
    mutationFn: () => deleteTimelineEvent(projectId, event.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: timelineEventKeys.list(projectId),
      });
      router.push(`/projects/${projectId}/timeline`);
    },
  });
  return (
    <article className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
      <header className="space-y-5 pr-8">
        <Badge variant="outline">イベントアイテム</Badge>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {event.title}
        </h1>
        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">登録日付</dt>
          <dd>
            {event.isApproximate ? "約 " : ""}
            {formatHistoricalDate(event.date)}
          </dd>
          <dt className="text-muted-foreground">タイムライン</dt>
          <dd>{event.parent.title}</dd>
        </dl>
      </header>
      <Separator />
      <section className="min-h-28 text-base leading-7">
        <DetailText value={event.description} />
      </section>
      <Separator />
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          出典・参考文献
        </h2>
        <SourceText value={event.sourceText} />
      </section>
      {event.externalUrl ? (
        <p>
          <a
            className="text-primary underline"
            href={event.externalUrl}
            rel="noreferrer"
            target="_blank"
          >
            外部URLを開く
          </a>
        </p>
      ) : null}
      {!readOnly ? (
        <div className="flex flex-wrap gap-2 border-t pt-6">
          <Button asChild>
            <Link href={`/projects/${projectId}/events/${event.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
              編集
            </Link>
          </Button>
          <Button
            variant="destructive"
            disabled={deletion.isPending}
            onClick={() => {
              if (window.confirm(`「${event.title}」を完全に削除しますか？`))
                deletion.mutate();
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            完全削除
          </Button>
        </div>
      ) : null}
      {!readOnly && deletion.error ? (
        <p role="alert" className="text-sm text-destructive">
          {deletion.error.message}
        </p>
      ) : null}
    </article>
  );
}
