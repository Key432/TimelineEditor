"use client";

import { Eye } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import type { TimelineItemType } from "@/features/item-types/types";
import { CollapsibleProjectDescription } from "@/features/projects/collapsible-project-description";
import type { Project } from "@/features/projects/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  parseTimelineFilters,
  writeTimelineFilters,
} from "@/features/timeline-items/timeline-filters";
import { TimelineWorkspace } from "@/features/timeline-items/timeline-workspace";
import type {
  HistoricalDate,
  TimelineItemSummary,
  TimelineLayoutMode,
} from "@/features/timeline-items/types";

export function PublicTimelinePageClient({
  publicId,
  project,
  initialItems,
  initialEvents,
  itemTypes,
  currentDate,
  layoutMode,
}: {
  publicId: string;
  project: Project;
  initialItems: TimelineItemSummary[];
  initialEvents: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  layoutMode: TimelineLayoutMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseTimelineFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <header className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <Badge variant="secondary">
            <Eye aria-hidden="true" />
            公開・閲覧専用
          </Badge>
        </div>
        {project.description ? (
          <CollapsibleProjectDescription description={project.description} />
        ) : null}
      </header>
      <TimelineWorkspace
        currentDate={currentDate}
        filters={filters}
        initialEvents={initialEvents}
        initialItems={initialItems}
        itemTypes={itemTypes}
        layoutMode={layoutMode}
        project={project}
        readOnly
        onFiltersChange={(nextFilters) => {
          const next = writeTimelineFilters(
            new URLSearchParams(searchParams.toString()),
            nextFilters,
          );
          window.history.replaceState(null, "", `${pathname}?${next}`);
        }}
        onLayoutModeChange={(nextLayout) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set("layout", nextLayout);
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        onOpenEvent={(eventId) =>
          router.push(`/public/${publicId}/events/${eventId}`)
        }
        onOpenItem={(itemId) =>
          router.push(`/public/${publicId}/items/${itemId}`)
        }
      />
    </div>
  );
}
