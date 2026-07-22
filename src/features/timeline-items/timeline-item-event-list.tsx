import { ChevronDown } from "lucide-react";
import Link from "next/link";

import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { formatHistoricalDate } from "@/features/timeline-items/historical-date";

export function TimelineItemEventList({
  projectId,
  events,
  basePath,
  hardNavigation = false,
}: {
  projectId: string;
  events: TimelineEventSummary[];
  basePath?: string;
  hardNavigation?: boolean;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">イベント 0件</p>;
  }

  return (
    <details className="group rounded-lg border bg-muted/15">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        イベント {events.length}件
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="divide-y border-t">
        {events.map((event) => {
          const href = `${basePath ?? `/projects/${projectId}`}/events/${event.id}`;
          const linkClassName =
            "truncate font-medium text-primary underline-offset-4 hover:underline";
          return (
            <li
              key={event.id}
              className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
            >
              {hardNavigation ? (
                <a className={linkClassName} href={href}>
                  {event.title}
                </a>
              ) : (
                <Link className={linkClassName} href={href}>
                  {event.title}
                </Link>
              )}
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {event.isApproximate ? "約 " : ""}
                {formatHistoricalDate(event.date)}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
