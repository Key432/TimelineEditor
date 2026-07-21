alter table public.timeline_items
add constraint timeline_items_project_id_id_key unique (project_id, id);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  timeline_item_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  event_year integer not null check (event_year >= 1),
  event_month integer check (event_month is null or event_month between 1 and 12),
  event_day integer check (event_day is null or event_day between 1 and 31),
  is_approximate boolean not null default false,
  summary text check (summary is null or length(summary) <= 2000),
  description text check (description is null or length(description) <= 20000),
  source_text text check (source_text is null or length(source_text) <= 10000),
  external_url text check (external_url is null or length(external_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_events_parent_project_fk
    foreign key (project_id, timeline_item_id)
    references public.timeline_items (project_id, id)
    on delete cascade,
  constraint timeline_events_precision_check check (
    (event_day is null or event_month is not null)
  ),
  constraint timeline_events_valid_date_check check (
    public.is_valid_historical_date(event_year, event_month, event_day)
  )
);

comment on table public.timeline_events is
'Child events attached to one range item in the initial release. The API maps events independently so a future junction table can add more parents.';

create index timeline_events_project_date_idx
on public.timeline_events (project_id, event_year, event_month, event_day, id);

create index timeline_events_parent_date_idx
on public.timeline_events (
  project_id,
  timeline_item_id,
  event_year,
  event_month,
  event_day,
  id
);

create function public.enforce_timeline_event_range_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_temporal_type text;
begin
  select temporal_type into parent_temporal_type
  from public.timeline_items
  where timeline_items.project_id = new.project_id
    and timeline_items.id = new.timeline_item_id;

  if not found then
    raise foreign_key_violation using message = 'Timeline event parent not found in project';
  end if;

  if parent_temporal_type <> 'range' then
    raise check_violation using message = 'Timeline events require a range parent';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_timeline_event_range_parent() from public;
grant execute on function public.enforce_timeline_event_range_parent()
to authenticated, service_role;

create trigger timeline_events_require_range_parent
before insert or update of project_id, timeline_item_id on public.timeline_events
for each row execute function public.enforce_timeline_event_range_parent();

create function public.prevent_point_parent_with_events()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.temporal_type = 'range'
    and new.temporal_type = 'point'
    and exists (
      select 1
      from public.timeline_events
      where timeline_events.project_id = old.project_id
        and timeline_events.timeline_item_id = old.id
    )
  then
    raise check_violation using message = 'A timeline item with events cannot become a point item';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_point_parent_with_events() from public;
grant execute on function public.prevent_point_parent_with_events()
to authenticated, service_role;

create trigger timeline_items_prevent_point_parent_with_events
before update of temporal_type on public.timeline_items
for each row execute function public.prevent_point_parent_with_events();

create trigger timeline_events_set_updated_at
before update on public.timeline_events
for each row execute function public.set_updated_at();

alter table public.timeline_events enable row level security;

create policy "Authenticated users can select permitted timeline events"
on public.timeline_events for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id
      and (
        projects.owner_id = (select auth.uid())
        or projects.visibility = 'public'
      )
  )
);

create policy "Anonymous users can select public timeline events"
on public.timeline_events for select
to anon
using (
  exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id
      and projects.visibility = 'public'
  )
);

create policy "Owners can insert timeline events"
on public.timeline_events for insert
to authenticated
with check (
  exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can update timeline events"
on public.timeline_events for update
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id
      and projects.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete timeline events"
on public.timeline_events for delete
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.timeline_events from anon;
grant select on table public.timeline_events to anon;
grant select, insert, update, delete on table public.timeline_events to authenticated;
grant all on table public.timeline_events to service_role;

create table public.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_type text not null check (source_type in ('timeline_item', 'timeline_event')),
  source_id uuid not null,
  target_type text not null check (target_type in ('timeline_item', 'timeline_event')),
  target_id uuid not null,
  relation_type text not null check (
    relation_type in ('influence', 'reference', 'collaboration', 'other')
  ),
  note text check (note is null or length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_relationships_distinct_endpoints_check check (
    source_type <> target_type or source_id <> target_id
  ),
  constraint entity_relationships_unique unique (
    project_id,
    source_type,
    source_id,
    target_type,
    target_id,
    relation_type
  )
);

comment on table public.entity_relationships is
'Reserved Phase 6 relation model. Registration and line rendering are intentionally deferred; polymorphic endpoints are validated by trigger.';

create index entity_relationships_source_idx
on public.entity_relationships (project_id, source_type, source_id);

create index entity_relationships_target_idx
on public.entity_relationships (project_id, target_type, target_id);

create function public.enforce_entity_relationship_endpoints()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (
    (new.source_type = 'timeline_item' and exists (
      select 1 from public.timeline_items
      where timeline_items.project_id = new.project_id
        and timeline_items.id = new.source_id
    ))
    or
    (new.source_type = 'timeline_event' and exists (
      select 1 from public.timeline_events
      where timeline_events.project_id = new.project_id
        and timeline_events.id = new.source_id
    ))
  ) then
    raise foreign_key_violation using message = 'Invalid relationship source';
  end if;

  if not (
    (new.target_type = 'timeline_item' and exists (
      select 1 from public.timeline_items
      where timeline_items.project_id = new.project_id
        and timeline_items.id = new.target_id
    ))
    or
    (new.target_type = 'timeline_event' and exists (
      select 1 from public.timeline_events
      where timeline_events.project_id = new.project_id
        and timeline_events.id = new.target_id
    ))
  ) then
    raise foreign_key_violation using message = 'Invalid relationship target';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_entity_relationship_endpoints() from public;
grant execute on function public.enforce_entity_relationship_endpoints()
to authenticated, service_role;

create trigger entity_relationships_validate_endpoints
before insert or update of project_id, source_type, source_id, target_type, target_id
on public.entity_relationships
for each row execute function public.enforce_entity_relationship_endpoints();

create trigger entity_relationships_set_updated_at
before update on public.entity_relationships
for each row execute function public.set_updated_at();

alter table public.entity_relationships enable row level security;

create policy "Authenticated users can select permitted entity relationships"
on public.entity_relationships for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = entity_relationships.project_id
      and (
        projects.owner_id = (select auth.uid())
        or projects.visibility = 'public'
      )
  )
);

create policy "Anonymous users can select public entity relationships"
on public.entity_relationships for select
to anon
using (
  exists (
    select 1 from public.projects
    where projects.id = entity_relationships.project_id
      and projects.visibility = 'public'
  )
);

create policy "Owners can insert entity relationships"
on public.entity_relationships for insert
to authenticated
with check (
  exists (
    select 1 from public.projects
    where projects.id = entity_relationships.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can update entity relationships"
on public.entity_relationships for update
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = entity_relationships.project_id
      and projects.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.projects
    where projects.id = entity_relationships.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete entity relationships"
on public.entity_relationships for delete
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = entity_relationships.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.entity_relationships from anon;
grant select on table public.entity_relationships to anon;
grant select, insert, update, delete on table public.entity_relationships to authenticated;
grant all on table public.entity_relationships to service_role;

create function public.cleanup_entity_relationships()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_type text;
begin
  deleted_type := case tg_table_name
    when 'timeline_items' then 'timeline_item'
    when 'timeline_events' then 'timeline_event'
  end;

  delete from public.entity_relationships
  where project_id = old.project_id
    and (
      (source_type = deleted_type and source_id = old.id)
      or (target_type = deleted_type and target_id = old.id)
    );
  return old;
end;
$$;

revoke all on function public.cleanup_entity_relationships() from public;
grant execute on function public.cleanup_entity_relationships()
to authenticated, service_role;

create trigger timeline_items_cleanup_relationships
after delete on public.timeline_items
for each row execute function public.cleanup_entity_relationships();

create trigger timeline_events_cleanup_relationships
after delete on public.timeline_events
for each row execute function public.cleanup_entity_relationships();
