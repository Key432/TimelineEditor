create table public.cloud_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  draft_scope text not null check (
    draft_scope = 'new'
    or draft_scope ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  payload jsonb not null check (
    jsonb_typeof(payload) in ('object', 'array')
    and pg_column_size(payload) <= 1048576
  ),
  base_version timestamptz,
  fingerprint text not null check (char_length(fingerprint) between 1 and 128),
  writer_id text not null check (char_length(writer_id) between 1 and 128),
  draft_version bigint not null default 1 check (draft_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, entity_type, draft_scope)
);

comment on table public.cloud_drafts is
'Mutable cross-device working drafts. Canonical entities and revision history are changed only by explicit saves.';

create index cloud_drafts_owner_updated_idx
on public.cloud_drafts (owner_id, updated_at);

alter table public.cloud_drafts enable row level security;

create policy "Owners can select cloud drafts"
on public.cloud_drafts for select
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = cloud_drafts.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can insert cloud drafts"
on public.cloud_drafts for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = cloud_drafts.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can update cloud drafts"
on public.cloud_drafts for update
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = cloud_drafts.project_id
      and projects.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = cloud_drafts.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete cloud drafts"
on public.cloud_drafts for delete
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = cloud_drafts.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.cloud_drafts from anon, authenticated;
grant select, insert, update, delete on table public.cloud_drafts to authenticated;
grant all on table public.cloud_drafts to service_role;

create function private.cleanup_cloud_drafts()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.cloud_drafts
  where updated_at < now() - interval '30 days';
$$;

revoke all on function private.cleanup_cloud_drafts() from public;
grant execute on function private.cleanup_cloud_drafts() to service_role;

create function public.run_cloud_draft_cleanup()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.cleanup_cloud_drafts();
$$;

revoke all on function public.run_cloud_draft_cleanup() from public;
grant execute on function public.run_cloud_draft_cleanup() to service_role;

select cron.schedule(
  'timeline-editor-cloud-draft-cleanup',
  '47 3 * * *',
  $job$select private.cleanup_cloud_drafts();$job$
);
