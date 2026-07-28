-- Phase L5 stores Markdown source in the existing description columns. No
-- rendered HTML or derived Markdown data is persisted.

create function private.markdown_to_search_text(markdown text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                coalesce(markdown, ''),
                '<[^>]+>', ' ', 'g'
              ),
              '!\[([^]]*)\]\([^)]+\)', '\1', 'g'
            ),
            '\[([^]]+)\]\([^)]+\)', '\1', 'g'
          ),
          '\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]', ' ', 'gi'
        ),
        '[#*_~`>]+', ' ', 'g'
      )
    ),
    ''
  );
$$;

revoke all on function private.markdown_to_search_text(text) from public;

create or replace function private.sync_timeline_item_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  type_name text;
begin
  select * into strict project_row from public.projects where id = new.project_id;
  select name into strict type_name from public.timeline_item_types
  where id = new.type_id and project_id = new.project_id;

  insert into public.search_documents (
    entity_type, entity_id, project_id, owner_id, is_public, title,
    project_name, content, detail_path, start_year, start_month, start_day,
    start_era, start_precision, start_original_text, start_calendar,
    end_year, end_month, end_day, end_era, end_precision, end_original_text,
    end_calendar, end_date_status, is_start_approximate,
    is_end_approximate, normalized_min, normalized_max, updated_at
  ) values (
    'timeline_item', new.id, new.project_id, project_row.owner_id,
    project_row.visibility = 'public', new.title, project_row.name,
    concat_ws(E'\n', new.title,
      private.markdown_to_search_text(new.description), new.source_text,
      new.external_url, type_name, new.start_original_text, new.end_original_text),
    '/projects/' || new.project_id::text || '/items/' || new.id::text,
    new.start_year, new.start_month, new.start_day, new.start_era,
    new.start_precision, new.start_original_text, new.start_calendar,
    new.end_year, new.end_month, new.end_day, new.end_era,
    new.end_precision, new.end_original_text, new.end_calendar,
    new.end_date_status,
    case when new.temporal_type = 'point'
      then new.is_point_approximate else new.is_start_approximate end,
    new.is_end_approximate, new.start_normalized_min,
    case when new.temporal_type = 'point' then new.start_normalized_max
      else coalesce(new.end_normalized_max, new.start_normalized_max) end,
    new.updated_at
  )
  on conflict (entity_type, entity_id) do update set
    project_id = excluded.project_id, owner_id = excluded.owner_id,
    is_public = excluded.is_public, title = excluded.title,
    project_name = excluded.project_name, content = excluded.content,
    detail_path = excluded.detail_path, start_year = excluded.start_year,
    start_month = excluded.start_month, start_day = excluded.start_day,
    start_era = excluded.start_era, start_precision = excluded.start_precision,
    start_original_text = excluded.start_original_text,
    start_calendar = excluded.start_calendar, end_year = excluded.end_year,
    end_month = excluded.end_month, end_day = excluded.end_day,
    end_era = excluded.end_era, end_precision = excluded.end_precision,
    end_original_text = excluded.end_original_text,
    end_calendar = excluded.end_calendar,
    end_date_status = excluded.end_date_status,
    is_start_approximate = excluded.is_start_approximate,
    is_end_approximate = excluded.is_end_approximate,
    normalized_min = excluded.normalized_min,
    normalized_max = excluded.normalized_max, updated_at = excluded.updated_at;
  return new;
end;
$$;

create or replace function private.sync_timeline_event_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  type_name text;
begin
  select * into strict project_row from public.projects where id = new.project_id;
  select timeline_item_types.name into strict type_name
  from public.timeline_items
  join public.timeline_item_types
    on timeline_item_types.project_id = timeline_items.project_id
    and timeline_item_types.id = timeline_items.type_id
  where timeline_items.project_id = new.project_id
    and timeline_items.id = new.timeline_item_id;

  insert into public.search_documents (
    entity_type, entity_id, project_id, owner_id, is_public, title,
    project_name, content, detail_path, start_year, start_month, start_day,
    start_era, start_precision, start_original_text, start_calendar,
    is_start_approximate, normalized_min, normalized_max, updated_at
  ) values (
    'timeline_event', new.id, new.project_id, project_row.owner_id,
    project_row.visibility = 'public', new.title, project_row.name,
    concat_ws(E'\n', new.title,
      private.markdown_to_search_text(new.description), new.source_text,
      new.external_url, type_name, new.event_original_text),
    '/projects/' || new.project_id::text || '/events/' || new.id::text,
    new.event_year, new.event_month, new.event_day, new.event_era,
    new.event_precision, new.event_original_text, new.event_calendar,
    new.is_approximate, new.event_normalized_min, new.event_normalized_max,
    new.updated_at
  )
  on conflict (entity_type, entity_id) do update set
    project_id = excluded.project_id, owner_id = excluded.owner_id,
    is_public = excluded.is_public, title = excluded.title,
    project_name = excluded.project_name, content = excluded.content,
    detail_path = excluded.detail_path, start_year = excluded.start_year,
    start_month = excluded.start_month, start_day = excluded.start_day,
    start_era = excluded.start_era, start_precision = excluded.start_precision,
    start_original_text = excluded.start_original_text,
    start_calendar = excluded.start_calendar, end_year = null,
    end_month = null, end_day = null, end_era = null,
    end_precision = null, end_original_text = null, end_calendar = null,
    end_date_status = null,
    is_start_approximate = excluded.is_start_approximate,
    is_end_approximate = false, normalized_min = excluded.normalized_min,
    normalized_max = excluded.normalized_max, updated_at = excluded.updated_at;
  return new;
end;
$$;

update public.timeline_items set updated_at = updated_at;
update public.timeline_events set updated_at = updated_at;

create function private.enforce_entity_history_generation_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.entity_history
  where id in (
    select id
    from public.entity_history
    where entity_type = new.entity_type
      and entity_id = new.entity_id
    order by revision desc
    offset 10
  );
  return new;
end;
$$;

revoke all on function private.enforce_entity_history_generation_limit()
from public;

create trigger entity_history_enforce_generation_limit
after insert on public.entity_history
for each row execute function private.enforce_entity_history_generation_limit();

create or replace function private.cleanup_timeline_history_and_trash()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.entity_history
  where created_at < now() - interval '10 days';

  delete from public.entity_history
  where id in (
    select id from (
      select id, row_number() over (
        partition by entity_type, entity_id order by revision desc
      ) as generation
      from public.entity_history
    ) as ranked where generation > 10
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
  where deleted_at < now() - interval '5 days';
  delete from public.timeline_items
  where deleted_at < now() - interval '5 days';
end;
$$;

revoke all on function private.cleanup_timeline_history_and_trash() from public;
grant execute on function private.cleanup_timeline_history_and_trash()
to service_role;

select private.cleanup_timeline_history_and_trash();
