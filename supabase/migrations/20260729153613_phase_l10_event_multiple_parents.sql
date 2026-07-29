create table public.timeline_event_item_links (
  project_id uuid not null references public.projects (id) on delete cascade,
  timeline_event_id uuid not null,
  timeline_item_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key (timeline_event_id, timeline_item_id),
  constraint timeline_event_item_links_event_fk
    foreign key (project_id, timeline_event_id)
    references public.timeline_events (project_id, id)
    on delete cascade,
  constraint timeline_event_item_links_item_fk
    foreign key (project_id, timeline_item_id)
    references public.timeline_items (project_id, id)
    on delete cascade,
  constraint timeline_event_item_links_order_key
    unique (timeline_event_id, sort_order)
);

comment on table public.timeline_event_item_links is
'Ordered, equal-status parent memberships for timeline events. sort_order controls forms and breadcrumbs; no parent is primary.';

create index timeline_event_item_links_item_idx
on public.timeline_event_item_links (project_id, timeline_item_id, timeline_event_id);

insert into public.timeline_event_item_links (
  project_id, timeline_event_id, timeline_item_id, sort_order
)
select project_id, id, timeline_item_id, 0
from public.timeline_events;

drop trigger timeline_events_require_range_parent on public.timeline_events;
drop function public.enforce_timeline_event_range_parent();
drop index public.timeline_events_parent_date_idx;
alter table public.timeline_events
  drop constraint timeline_events_parent_project_fk;
comment on column public.timeline_events.timeline_item_id is
'Denormalized compatibility pointer to the first ordered parent. It has no primary-parent meaning; current reads use timeline_event_item_links.';

create function public.enforce_timeline_event_item_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.timeline_events
    where project_id = new.project_id and id = new.timeline_event_id
  ) then
    raise foreign_key_violation using message = 'Timeline event not found in project';
  end if;
  if not exists (
    select 1 from public.timeline_items
    where project_id = new.project_id and id = new.timeline_item_id
  ) then
    raise foreign_key_violation using message = 'Timeline item not found in project';
  end if;
  if exists (
    select 1 from public.timeline_items
    where project_id = new.project_id
      and id = new.timeline_item_id
      and temporal_type <> 'range'
  ) then
    raise check_violation using message = 'Timeline events require range parents in the same project';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_timeline_event_item_link() from public;
grant execute on function public.enforce_timeline_event_item_link()
to authenticated, service_role;

create trigger timeline_event_item_links_validate
before insert or update on public.timeline_event_item_links
for each row execute function public.enforce_timeline_event_item_link();

create function public.migrate_legacy_timeline_event_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.timeline_item_id is not null then
    insert into public.timeline_event_item_links (
      project_id, timeline_event_id, timeline_item_id, sort_order
    ) values (new.project_id, new.id, new.timeline_item_id, 0)
    on conflict (timeline_event_id, timeline_item_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.migrate_legacy_timeline_event_parent() from public;
grant execute on function public.migrate_legacy_timeline_event_parent()
to authenticated, service_role;

create trigger timeline_events_migrate_legacy_parent
after insert on public.timeline_events
for each row when (new.timeline_item_id is not null)
execute function public.migrate_legacy_timeline_event_parent();

create or replace function public.prevent_point_parent_with_events()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.temporal_type = 'range'
    and new.temporal_type = 'point'
    and exists (
      select 1 from public.timeline_event_item_links
      where project_id = old.project_id and timeline_item_id = old.id
    )
  then
    raise check_violation using message = 'A timeline item with events cannot become a point item';
  end if;
  return new;
end;
$$;

create function public.delete_events_losing_last_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.timeline_events event
  set timeline_item_id = (
    select link.timeline_item_id
    from public.timeline_event_item_links link
    where link.timeline_event_id = event.id
      and link.timeline_item_id <> old.id
    order by link.sort_order
    limit 1
  )
  where event.project_id = old.project_id
    and event.timeline_item_id = old.id
    and exists (
      select 1 from public.timeline_event_item_links link
      where link.timeline_event_id = event.id
        and link.timeline_item_id <> old.id
    );

  delete from public.timeline_events event
  where event.project_id = old.project_id
    and exists (
      select 1 from public.timeline_event_item_links link
      where link.timeline_event_id = event.id
        and link.timeline_item_id = old.id
    )
    and not exists (
      select 1 from public.timeline_event_item_links link
      where link.timeline_event_id = event.id
        and link.timeline_item_id <> old.id
    );
  return old;
end;
$$;

revoke all on function public.delete_events_losing_last_parent() from public;
grant execute on function public.delete_events_losing_last_parent()
to authenticated, service_role;

create trigger timeline_items_delete_events_losing_last_parent
before delete on public.timeline_items
for each row execute function public.delete_events_losing_last_parent();

alter table public.timeline_event_item_links enable row level security;

create policy "Readers can select permitted timeline event item links"
on public.timeline_event_item_links for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where id = timeline_event_item_links.project_id
      and (
        owner_id = (select auth.uid())
        or (
          visibility = 'public'
          and exists (
            select 1 from public.timeline_events event
            where event.project_id = timeline_event_item_links.project_id
              and event.id = timeline_event_item_links.timeline_event_id
              and event.deleted_at is null
          )
          and exists (
            select 1 from public.timeline_items item
            where item.project_id = timeline_event_item_links.project_id
              and item.id = timeline_event_item_links.timeline_item_id
              and item.deleted_at is null
          )
        )
      )
  )
);

create policy "Anonymous users can select public timeline event item links"
on public.timeline_event_item_links for select
to anon
using (
  exists (
    select 1 from public.projects
    where id = timeline_event_item_links.project_id
      and visibility = 'public'
      and exists (
        select 1 from public.timeline_events event
        where event.project_id = timeline_event_item_links.project_id
          and event.id = timeline_event_item_links.timeline_event_id
          and event.deleted_at is null
      )
      and exists (
        select 1 from public.timeline_items item
        where item.project_id = timeline_event_item_links.project_id
          and item.id = timeline_event_item_links.timeline_item_id
          and item.deleted_at is null
      )
  )
);

create policy "Owners can insert timeline event item links"
on public.timeline_event_item_links for insert
to authenticated
with check (
  exists (
    select 1 from public.projects
    where id = timeline_event_item_links.project_id
      and owner_id = (select auth.uid())
  )
);

create policy "Owners can update timeline event item links"
on public.timeline_event_item_links for update
to authenticated
using (
  exists (
    select 1 from public.projects
    where id = timeline_event_item_links.project_id
      and owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.projects
    where id = timeline_event_item_links.project_id
      and owner_id = (select auth.uid())
  )
);

create policy "Owners can delete timeline event item links"
on public.timeline_event_item_links for delete
to authenticated
using (
  exists (
    select 1 from public.projects
    where id = timeline_event_item_links.project_id
      and owner_id = (select auth.uid())
  )
);

revoke all on table public.timeline_event_item_links from anon, authenticated;
grant select on table public.timeline_event_item_links to anon;
grant select, insert, update, delete on table public.timeline_event_item_links to authenticated;
grant all on table public.timeline_event_item_links to service_role;

create function public.replace_timeline_event_parents(
  p_project_id uuid,
  p_event_id uuid,
  p_timeline_item_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_timeline_item_ids, 1), 0) < 1
    or coalesce(array_length(p_timeline_item_ids, 1), 0) > 100
    or (select count(distinct value) from unnest(p_timeline_item_ids) as value)
      <> array_length(p_timeline_item_ids, 1)
  then
    raise check_violation using message = 'Timeline events require 1 to 100 distinct parents';
  end if;

  perform 1 from public.timeline_events
  where project_id = p_project_id and id = p_event_id
  for update;
  if not found then
    raise foreign_key_violation using message = 'Timeline event not found in project';
  end if;

  delete from public.timeline_event_item_links
  where project_id = p_project_id and timeline_event_id = p_event_id;

  insert into public.timeline_event_item_links (
    project_id, timeline_event_id, timeline_item_id, sort_order
  )
  select p_project_id, p_event_id, value, ordinality - 1
  from unnest(p_timeline_item_ids) with ordinality as parent(value, ordinality);

  update public.timeline_events
  set timeline_item_id = p_timeline_item_ids[1]
  where project_id = p_project_id and id = p_event_id;
end;
$$;

revoke all on function public.replace_timeline_event_parents(uuid, uuid, uuid[]) from public;
grant execute on function public.replace_timeline_event_parents(uuid, uuid, uuid[])
to authenticated, service_role;

alter function public.import_project_data(uuid, text, jsonb)
rename to import_project_data_v4;
revoke all on function public.import_project_data_v4(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.import_project_data_v4(uuid, text, jsonb)
to authenticated;

create function public.import_project_data(
  p_target_project_id uuid,
  p_mode text,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  marked_payload jsonb := p_payload;
  destination_id uuid;
  source_event jsonb;
  source_parent_id text;
  mapped_event_id uuid;
  mapped_parent_ids uuid[];
  item_map jsonb := '{}'::jsonb;
  event_map jsonb := '{}'::jsonb;
begin
  marked_payload := jsonb_set(marked_payload, '{timelineItems}', coalesce((
    select jsonb_agg(jsonb_set(
      item.value,
      '{aliases}',
      coalesce(item.value->'aliases', '[]'::jsonb)
        || jsonb_build_array('__timeline_editor_l10_item:' || (item.value->>'id'))
    ))
    from jsonb_array_elements(coalesce(p_payload->'timelineItems', '[]'::jsonb)) item(value)
  ), '[]'::jsonb));
  marked_payload := jsonb_set(marked_payload, '{timelineEvents}', coalesce((
    select jsonb_agg(
      jsonb_set(
        jsonb_set(
          event.value,
          '{timelineItemId}',
          coalesce(event.value->'timelineItemIds'->0, 'null'::jsonb)
        ),
        '{aliases}',
        coalesce(event.value->'aliases', '[]'::jsonb)
          || jsonb_build_array('__timeline_editor_l10_event:' || (event.value->>'id'))
      )
    )
    from jsonb_array_elements(coalesce(p_payload->'timelineEvents', '[]'::jsonb)) event(value)
  ), '[]'::jsonb));

  destination_id := public.import_project_data_v4(
    p_target_project_id,
    p_mode,
    marked_payload
  );

  select coalesce(jsonb_object_agg(
    substring(alias from length('__timeline_editor_l10_item:') + 1),
    item.id::text
  ), '{}'::jsonb)
  into item_map
  from public.timeline_items item
  cross join lateral unnest(item.aliases) alias
  where item.project_id = destination_id
    and alias like '__timeline_editor_l10_item:%';

  select coalesce(jsonb_object_agg(
    substring(alias from length('__timeline_editor_l10_event:') + 1),
    event.id::text
  ), '{}'::jsonb)
  into event_map
  from public.timeline_events event
  cross join lateral unnest(event.aliases) alias
  where event.project_id = destination_id
    and alias like '__timeline_editor_l10_event:%';

  for source_event in
    select value
    from jsonb_array_elements(coalesce(p_payload->'timelineEvents', '[]'::jsonb))
  loop
    mapped_event_id := nullif(event_map->>(source_event->>'id'), '')::uuid;
    mapped_parent_ids := array[]::uuid[];
    for source_parent_id in
      select jsonb_array_elements_text(source_event->'timelineItemIds')
    loop
      mapped_parent_ids := array_append(
        mapped_parent_ids,
        nullif(item_map->>source_parent_id, '')::uuid
      );
    end loop;
    perform public.replace_timeline_event_parents(
      destination_id,
      mapped_event_id,
      mapped_parent_ids
    );
  end loop;

  update public.timeline_items
  set aliases = array(
    select alias from unnest(aliases) alias
    where alias not like '__timeline_editor_l10_item:%'
  )
  where project_id = destination_id;
  update public.timeline_events
  set aliases = array(
    select alias from unnest(aliases) alias
    where alias not like '__timeline_editor_l10_event:%'
  )
  where project_id = destination_id;

  return destination_id;
end;
$$;

revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb)
to authenticated;

create or replace function public.trash_timeline_item(
  p_project_id uuid,
  p_item_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_time timestamptz := now();
  group_id uuid := gen_random_uuid();
begin
  perform private.require_project_owner(p_project_id);

  update public.timeline_events event
  set timeline_item_id = (
    select link.timeline_item_id
    from public.timeline_event_item_links link
    join public.timeline_items item
      on item.project_id = link.project_id and item.id = link.timeline_item_id
    where link.timeline_event_id = event.id
      and link.timeline_item_id <> p_item_id
      and item.deleted_at is null
    order by link.sort_order
    limit 1
  )
  where event.project_id = p_project_id
    and event.timeline_item_id = p_item_id
    and exists (
      select 1
      from public.timeline_event_item_links link
      join public.timeline_items item
        on item.project_id = link.project_id and item.id = link.timeline_item_id
      where link.timeline_event_id = event.id
        and link.timeline_item_id <> p_item_id
        and item.deleted_at is null
    );

  update public.timeline_events event set
    deleted_at = deleted_time,
    deleted_by = (select auth.uid()),
    trash_group_id = group_id
  where event.project_id = p_project_id
    and event.deleted_at is null
    and exists (
      select 1 from public.timeline_event_item_links link
      where link.timeline_event_id = event.id
        and link.timeline_item_id = p_item_id
    )
    and not exists (
      select 1
      from public.timeline_event_item_links link
      join public.timeline_items item
        on item.project_id = link.project_id and item.id = link.timeline_item_id
      where link.timeline_event_id = event.id
        and link.timeline_item_id <> p_item_id
        and item.deleted_at is null
    );

  update public.timeline_items set
    deleted_at = deleted_time,
    deleted_by = (select auth.uid()),
    trash_group_id = group_id
  where project_id = p_project_id and id = p_item_id and deleted_at is null;
  return found;
end;
$$;

create or replace function public.restore_trashed_entity(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  group_id uuid;
begin
  perform private.require_project_owner(p_project_id);
  if p_entity_type = 'timeline_item' then
    select trash_group_id into group_id from public.timeline_items
    where project_id = p_project_id and id = p_entity_id and deleted_at is not null;
    if not found then return false; end if;
    update public.timeline_items set deleted_at = null, deleted_by = null, trash_group_id = null
    where project_id = p_project_id and id = p_entity_id;
    update public.timeline_events event
    set deleted_at = null, deleted_by = null, trash_group_id = null
    where event.project_id = p_project_id
      and event.trash_group_id = group_id
      and exists (
        select 1 from public.timeline_event_item_links link
        where link.timeline_event_id = event.id
          and link.timeline_item_id = p_entity_id
      );
    return true;
  elsif p_entity_type = 'timeline_event' then
    if not exists (
      select 1
      from public.timeline_event_item_links link
      join public.timeline_items item
        on item.project_id = link.project_id and item.id = link.timeline_item_id
      where link.project_id = p_project_id
        and link.timeline_event_id = p_entity_id
        and item.deleted_at is null
    ) then
      return false;
    end if;
    update public.timeline_events set deleted_at = null, deleted_by = null, trash_group_id = null
    where project_id = p_project_id and id = p_entity_id and deleted_at is not null;
    return found;
  end if;
  raise invalid_parameter_value using message = 'Invalid entity type';
end;
$$;
