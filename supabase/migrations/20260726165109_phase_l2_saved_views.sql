create table public.timeline_saved_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  configuration jsonb not null check (
    jsonb_typeof(configuration) = 'object'
    and pg_column_size(configuration) <= 32768
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create index timeline_saved_views_project_id_updated_at_idx
on public.timeline_saved_views (project_id, updated_at desc);

create trigger timeline_saved_views_set_updated_at
before update on public.timeline_saved_views
for each row execute function public.set_updated_at();

alter table public.timeline_saved_views enable row level security;

create function public.enforce_timeline_saved_view_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.timeline_saved_views
      where project_id = new.project_id) >= 50 then
    raise exception 'timeline saved view limit exceeded';
  end if;
  return new;
end;
$$;

create trigger timeline_saved_views_enforce_limit
before insert on public.timeline_saved_views
for each row execute function public.enforce_timeline_saved_view_limit();

revoke all on function public.enforce_timeline_saved_view_limit() from public;
grant execute on function public.enforce_timeline_saved_view_limit() to authenticated;

create policy "Owners can select timeline saved views"
on public.timeline_saved_views for select to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_saved_views.project_id
    and projects.owner_id = (select auth.uid())
));

create policy "Owners can insert timeline saved views"
on public.timeline_saved_views for insert to authenticated
with check (exists (
  select 1 from public.projects
  where projects.id = timeline_saved_views.project_id
    and projects.owner_id = (select auth.uid())
));

create policy "Owners can update timeline saved views"
on public.timeline_saved_views for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_saved_views.project_id
    and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects
  where projects.id = timeline_saved_views.project_id
    and projects.owner_id = (select auth.uid())
));

create policy "Owners can delete timeline saved views"
on public.timeline_saved_views for delete to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_saved_views.project_id
    and projects.owner_id = (select auth.uid())
));

revoke all on table public.timeline_saved_views from anon;
grant select, insert, update, delete on table public.timeline_saved_views to authenticated;
