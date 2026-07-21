"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
}: {
  projectId: string;
  event: TimelineEvent;
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
    <article className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {event.isApproximate ? "約 " : ""}
          {formatHistoricalDate(event.date)} · 親項目: {event.parent.title}
        </p>
      </header>
      <section>
        <h2 className="mb-1 font-medium">概要</h2>
        <DetailText value={event.summary} />
      </section>
      <section>
        <h2 className="mb-1 font-medium">本文</h2>
        <DetailText value={event.description} />
      </section>
      <section>
        <h2 className="mb-1 font-medium">出典・参考文献</h2>
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
      <div className="flex flex-wrap gap-2">
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
      {deletion.error ? (
        <p role="alert" className="text-sm text-destructive">
          {deletion.error.message}
        </p>
      ) : null}
    </article>
  );
}
