create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema private to authenticated;

alter table public.timeline_items
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add column trash_group_id uuid;

alter table public.timeline_events
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add column trash_group_id uuid;

create index timeline_items_project_deleted_idx
on public.timeline_items (project_id, deleted_at, id);

create index timeline_events_project_deleted_idx
on public.timeline_events (project_id, deleted_at, id);

create table public.entity_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  entity_id uuid not null,
  revision bigint not null check (revision > 0),
  operation_group_id uuid not null default gen_random_uuid(),
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  operation text not null default 'update' check (operation in ('update', 'restore', 'checkpoint')),
  is_checkpoint boolean not null default false,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, revision)
);

comment on table public.entity_history is
'Field-level before/after changes for timeline items and events. Full entity snapshots are intentionally not stored.';

create index entity_history_entity_revision_idx
on public.entity_history (project_id, entity_type, entity_id, revision desc);

create index entity_history_project_created_idx
on public.entity_history (project_id, created_at, id);

alter table public.entity_history enable row level security;

create policy "Owners can select entity history"
on public.entity_history for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = entity_history.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.entity_history from anon, authenticated;
grant select on table public.entity_history to authenticated;
grant all on table public.entity_history to service_role;

create function private.history_changes(old_row jsonb, new_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      changed.key,
      jsonb_build_object('before', old_row -> changed.key, 'after', new_row -> changed.key)
    ),
    '{}'::jsonb
  )
  from (
    select key
    from jsonb_object_keys(old_row) as key
    where old_row -> key is distinct from new_row -> key
  ) as changed;
$$;

revoke all on function private.history_changes(jsonb, jsonb) from public;

create function private.capture_entity_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_content jsonb;
  new_content jsonb;
  field_changes jsonb;
  next_revision bigint;
  history_operation text;
  operation_group uuid;
begin
  old_content := to_jsonb(old)
    - array['id', 'project_id', 'manual_order', 'created_at', 'updated_at',
      'start_normalized_min', 'start_normalized_max', 'end_normalized_min',
      'end_normalized_max', 'event_normalized_min', 'event_normalized_max',
      'deleted_at', 'deleted_by', 'trash_group_id'];
  new_content := to_jsonb(new)
    - array['id', 'project_id', 'manual_order', 'created_at', 'updated_at',
      'start_normalized_min', 'start_normalized_max', 'end_normalized_min',
      'end_normalized_max', 'event_normalized_min', 'event_normalized_max',
      'deleted_at', 'deleted_by', 'trash_group_id'];
  field_changes := private.history_changes(old_content, new_content);
  if field_changes = '{}'::jsonb then
    return new;
  end if;

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.entity_history
  where entity_type = case when tg_table_name = 'timeline_items'
      then 'timeline_item' else 'timeline_event' end
    and entity_id = new.id;

  history_operation := coalesce(
    nullif(current_setting('timeline_editor.history_operation', true), ''),
    'update'
  );
  operation_group := coalesce(
    nullif(current_setting('timeline_editor.operation_group_id', true), '')::uuid,
    gen_random_uuid()
  );

  insert into public.entity_history (
    project_id, entity_type, entity_id, revision, operation_group_id,
    changes, operation, actor_id
  ) values (
    new.project_id,
    case when tg_table_name = 'timeline_items' then 'timeline_item' else 'timeline_event' end,
    new.id,
    next_revision,
    operation_group,
    field_changes,
    case when history_operation = 'restore' then 'restore' else 'update' end,
    auth.uid()
  );

  delete from public.entity_history
  where id in (
    select id
    from public.entity_history
    where entity_type = case when tg_table_name = 'timeline_items'
        then 'timeline_item' else 'timeline_event' end
      and entity_id = new.id
    order by revision desc
    offset 20
  );

  return new;
end;
$$;

revoke all on function private.capture_entity_history() from public;

create trigger timeline_items_capture_history
after update on public.timeline_items
for each row execute function private.capture_entity_history();

create trigger timeline_events_capture_history
after update on public.timeline_events
for each row execute function private.capture_entity_history();

create function private.delete_entity_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.entity_history
  where entity_type = case when tg_table_name = 'timeline_items'
      then 'timeline_item' else 'timeline_event' end
    and entity_id = old.id;
  return old;
end;
$$;

revoke all on function private.delete_entity_history() from public;

create trigger timeline_items_delete_history
after delete on public.timeline_items
for each row execute function private.delete_entity_history();

create trigger timeline_events_delete_history
after delete on public.timeline_events
for each row execute function private.delete_entity_history();

create function private.require_project_owner(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = auth.uid()
  ) then
    raise insufficient_privilege using message = 'Project owner required';
  end if;
end;
$$;

revoke all on function private.require_project_owner(uuid) from public;
grant execute on function private.require_project_owner(uuid) to authenticated;

create function private.create_entity_checkpoint(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns public.entity_history
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkpoint public.entity_history;
  next_revision bigint;
begin
  perform private.require_project_owner(p_project_id);
  if p_entity_type not in ('timeline_item', 'timeline_event') then
    raise invalid_parameter_value using message = 'Invalid entity type';
  end if;
  if (p_entity_type = 'timeline_item' and not exists (
      select 1 from public.timeline_items
      where id = p_entity_id and project_id = p_project_id and deleted_at is null
    )) or (p_entity_type = 'timeline_event' and not exists (
      select 1 from public.timeline_events
      where id = p_entity_id and project_id = p_project_id and deleted_at is null
    )) then
    raise no_data_found using message = 'Entity not found';
  end if;

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.entity_history
  where entity_type = p_entity_type and entity_id = p_entity_id;

  insert into public.entity_history (
    project_id, entity_type, entity_id, revision, changes,
    operation, is_checkpoint, actor_id
  ) values (
    p_project_id, p_entity_type, p_entity_id, next_revision, '{}'::jsonb,
    'checkpoint', true, auth.uid()
  ) returning * into checkpoint;

  delete from public.entity_history
  where id in (
    select id from public.entity_history
    where entity_type = p_entity_type and entity_id = p_entity_id
    order by revision desc offset 20
  );
  return checkpoint;
end;
$$;

revoke all on function private.create_entity_checkpoint(uuid, text, uuid) from public;
grant execute on function private.create_entity_checkpoint(uuid, text, uuid) to authenticated;

create function public.create_entity_checkpoint(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns public.entity_history
language sql
security invoker
set search_path = ''
as $$
  select private.create_entity_checkpoint(p_project_id, p_entity_type, p_entity_id);
$$;

revoke all on function public.create_entity_checkpoint(uuid, text, uuid) from public;
grant execute on function public.create_entity_checkpoint(uuid, text, uuid) to authenticated;

create function public.restore_entity_history(
  p_project_id uuid,
  p_history_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.entity_history;
  later public.entity_history;
  state jsonb;
  changed_key text;
  item_row public.timeline_items;
  event_row public.timeline_events;
begin
  perform private.require_project_owner(p_project_id);
  select * into target from public.entity_history
  where id = p_history_id and project_id = p_project_id;
  if not found then return false; end if;

  if target.entity_type = 'timeline_item' then
    select to_jsonb(item) into state from public.timeline_items as item
    where id = target.entity_id and project_id = p_project_id and deleted_at is null;
  else
    select to_jsonb(event) into state from public.timeline_events as event
    where id = target.entity_id and project_id = p_project_id and deleted_at is null;
  end if;
  if state is null then return false; end if;

  for later in
    select * from public.entity_history
    where entity_type = target.entity_type and entity_id = target.entity_id
      and revision > target.revision
    order by revision desc
  loop
    for changed_key in select jsonb_object_keys(later.changes)
    loop
      state := jsonb_set(
        state,
        array[changed_key],
        later.changes -> changed_key -> 'before',
        true
      );
    end loop;
  end loop;

  perform set_config('timeline_editor.history_operation', 'restore', true);
  if target.entity_type = 'timeline_item' then
    item_row := jsonb_populate_record(null::public.timeline_items, state);
    update public.timeline_items set
      type_id = item_row.type_id, title = item_row.title,
      description = item_row.description, source_text = item_row.source_text,
      external_url = item_row.external_url, temporal_type = item_row.temporal_type,
      color_override = item_row.color_override, is_visible = item_row.is_visible,
      start_year = item_row.start_year, start_month = item_row.start_month,
      start_day = item_row.start_day, start_era = item_row.start_era,
      start_precision = item_row.start_precision,
      start_original_text = item_row.start_original_text,
      start_calendar = item_row.start_calendar,
      is_start_approximate = item_row.is_start_approximate,
      start_uncertainty_years = item_row.start_uncertainty_years,
      end_date_status = item_row.end_date_status, end_year = item_row.end_year,
      end_month = item_row.end_month, end_day = item_row.end_day,
      end_era = item_row.end_era, end_precision = item_row.end_precision,
      end_original_text = item_row.end_original_text,
      end_calendar = item_row.end_calendar,
      is_end_approximate = item_row.is_end_approximate,
      end_uncertainty_years = item_row.end_uncertainty_years,
      is_point_approximate = item_row.is_point_approximate
    where id = target.entity_id and project_id = p_project_id and deleted_at is null;
  else
    event_row := jsonb_populate_record(null::public.timeline_events, state);
    update public.timeline_events set
      timeline_item_id = event_row.timeline_item_id, title = event_row.title,
      event_year = event_row.event_year, event_month = event_row.event_month,
      event_day = event_row.event_day, event_era = event_row.event_era,
      event_precision = event_row.event_precision,
      event_original_text = event_row.event_original_text,
      event_calendar = event_row.event_calendar,
      is_approximate = event_row.is_approximate,
      description = event_row.description, source_text = event_row.source_text,
      external_url = event_row.external_url
    where id = target.entity_id and project_id = p_project_id and deleted_at is null;
  end if;
  return found;
end;
$$;

revoke all on function public.restore_entity_history(uuid, uuid) from public;
grant execute on function public.restore_entity_history(uuid, uuid) to authenticated;

create function public.trash_timeline_item(p_project_id uuid, p_item_id uuid)
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
  update public.timeline_events set
    deleted_at = deleted_time, deleted_by = auth.uid(), trash_group_id = group_id
  where project_id = p_project_id and timeline_item_id = p_item_id
    and deleted_at is null;
  update public.timeline_items set
    deleted_at = deleted_time, deleted_by = auth.uid(), trash_group_id = group_id
  where project_id = p_project_id and id = p_item_id and deleted_at is null;
  return found;
end;
$$;

create function public.trash_timeline_event(p_project_id uuid, p_event_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_project_owner(p_project_id);
  update public.timeline_events set
    deleted_at = now(), deleted_by = auth.uid(), trash_group_id = gen_random_uuid()
  where project_id = p_project_id and id = p_event_id and deleted_at is null;
  return found;
end;
$$;

create function public.restore_trashed_entity(
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
    update public.timeline_events set deleted_at = null, deleted_by = null, trash_group_id = null
    where project_id = p_project_id and timeline_item_id = p_entity_id
      and trash_group_id = group_id;
    return true;
  elsif p_entity_type = 'timeline_event' then
    if exists (
      select 1 from public.timeline_events as event
      join public.timeline_items as item on item.id = event.timeline_item_id
        and item.project_id = event.project_id
      where event.project_id = p_project_id and event.id = p_entity_id
        and event.deleted_at is not null and item.deleted_at is not null
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

create function public.purge_trashed_entity(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_project_owner(p_project_id);
  if p_entity_type = 'timeline_item' then
    delete from public.timeline_items
    where project_id = p_project_id and id = p_entity_id and deleted_at is not null;
  elsif p_entity_type = 'timeline_event' then
    delete from public.timeline_events
    where project_id = p_project_id and id = p_entity_id and deleted_at is not null;
  else
    raise invalid_parameter_value using message = 'Invalid entity type';
  end if;
  return found;
end;
$$;

revoke all on function public.trash_timeline_item(uuid, uuid) from public;
revoke all on function public.trash_timeline_event(uuid, uuid) from public;
revoke all on function public.restore_trashed_entity(uuid, text, uuid) from public;
revoke all on function public.purge_trashed_entity(uuid, text, uuid) from public;
grant execute on function public.trash_timeline_item(uuid, uuid) to authenticated;
grant execute on function public.trash_timeline_event(uuid, uuid) to authenticated;
grant execute on function public.restore_trashed_entity(uuid, text, uuid) to authenticated;
grant execute on function public.purge_trashed_entity(uuid, text, uuid) to authenticated;

create function private.cleanup_timeline_history_and_trash()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.entity_history
  where created_at < now() - interval '90 days';

  delete from public.entity_history
  where id in (
    select id from (
      select id, row_number() over (
        partition by entity_type, entity_id order by revision desc
      ) as generation
      from public.entity_history
    ) as ranked where generation > 20
  );

  delete from public.entity_history as history
  using (
    select id from (
      select id, project_id,
        sum(pg_column_size(entity_history)) over (
          partition by project_id order by created_at desc, id
        ) as retained_bytes
      from public.entity_history
    ) as sized
    where retained_bytes > 25 * 1024 * 1024
  ) as expired
  where history.id = expired.id;

  delete from public.timeline_events
  where deleted_at < now() - interval '30 days';
  delete from public.timeline_items
  where deleted_at < now() - interval '30 days';
end;
$$;

revoke all on function private.cleanup_timeline_history_and_trash() from public;
grant usage on schema private to service_role;
grant execute on function private.cleanup_timeline_history_and_trash() to service_role;

create function public.run_timeline_retention_cleanup()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.cleanup_timeline_history_and_trash();
$$;

revoke all on function public.run_timeline_retention_cleanup() from public;
grant execute on function public.run_timeline_retention_cleanup() to service_role;

-- Keep deleted entities out of public Data API reads while allowing owners to
-- inspect their own trash through the existing RLS-protected tables.
drop policy "Authenticated users can select permitted timeline items" on public.timeline_items;
create policy "Authenticated users can select permitted timeline items"
on public.timeline_items for select to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = timeline_items.project_id
      and (
        projects.owner_id = (select auth.uid())
        or (projects.visibility = 'public' and timeline_items.deleted_at is null)
      )
  )
);

drop policy "Anonymous users can select public timeline items" on public.timeline_items;
create policy "Anonymous users can select public timeline items"
on public.timeline_items for select to anon
using (
  deleted_at is null and exists (
    select 1 from public.projects
    where projects.id = timeline_items.project_id and projects.visibility = 'public'
  )
);

drop policy "Authenticated users can select permitted timeline events" on public.timeline_events;
create policy "Authenticated users can select permitted timeline events"
on public.timeline_events for select to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id
      and (
        projects.owner_id = (select auth.uid())
        or (projects.visibility = 'public' and timeline_events.deleted_at is null)
      )
  )
);

drop policy "Anonymous users can select public timeline events" on public.timeline_events;
create policy "Anonymous users can select public timeline events"
on public.timeline_events for select to anon
using (
  deleted_at is null and exists (
    select 1 from public.projects
    where projects.id = timeline_events.project_id and projects.visibility = 'public'
  )
);

create or replace function private.remove_deleted_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    delete from public.search_documents
    where entity_type = case when tg_table_name = 'timeline_items'
        then 'timeline_item' else 'timeline_event' end
      and entity_id = new.id;
    return null;
  end if;
  return new;
end;
$$;

revoke all on function private.remove_deleted_search_document() from public;

create trigger timeline_items_zz_remove_deleted_search_document
after update of deleted_at on public.timeline_items
for each row when (new.deleted_at is not null)
execute function private.remove_deleted_search_document();

create trigger timeline_events_zz_remove_deleted_search_document
after update of deleted_at on public.timeline_events
for each row when (new.deleted_at is not null)
execute function private.remove_deleted_search_document();

select cron.schedule(
  'timeline-editor-retention-cleanup',
  '17 3 * * *',
  $job$select private.cleanup_timeline_history_and_trash();$job$
);
