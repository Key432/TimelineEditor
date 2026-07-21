alter table public.timeline_items
  drop column summary;

alter table public.timeline_events
  drop column summary;
