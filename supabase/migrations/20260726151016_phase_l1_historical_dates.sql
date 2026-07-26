create function public.historical_date_sort_key(
  p_era text,
  p_precision text,
  p_year integer,
  p_month integer,
  p_day integer,
  p_boundary text
)
returns bigint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when p_year is null then null else
    (
      case
        when p_precision = 'century' and p_era = 'ce' and p_boundary = 'start'
          then (p_year - 1)::bigint * 100 + 1
        when p_precision = 'century' and p_era = 'ce'
          then p_year::bigint * 100
        when p_precision = 'century' and p_era = 'bce' and p_boundary = 'start'
          then 1 - p_year::bigint * 100
        when p_precision = 'century' and p_era = 'bce'
          then -((p_year - 1)::bigint * 100)
        when p_precision = 'decade' and p_era = 'ce' and p_boundary = 'end'
          then p_year::bigint + 9
        when p_precision = 'decade' and p_era = 'bce' and p_boundary = 'start'
          then 1 - (p_year::bigint + 9)
        when p_era = 'bce' then 1 - p_year::bigint
        else p_year::bigint
      end * 372
    ) +
    case when p_precision in ('day', 'month')
      then coalesce(p_month, case when p_boundary = 'start' then 1 else 12 end)
      else case when p_boundary = 'start' then 1 else 12 end
    end * 31 +
    case when p_precision = 'day'
      then coalesce(p_day, case when p_boundary = 'start' then 1 else 31 end)
      else case when p_boundary = 'start' then 1 else 31 end
    end
  end;
$$;

revoke all on function public.historical_date_sort_key(text, text, integer, integer, integer, text) from public;
grant execute on function public.historical_date_sort_key(text, text, integer, integer, integer, text) to anon, authenticated, service_role;

create function public.is_valid_extended_historical_date(
  p_era text,
  p_precision text,
  p_year integer,
  p_month integer,
  p_day integer,
  p_calendar text
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_year is null or (
    p_era in ('ce', 'bce')
    and p_precision in ('day', 'month', 'year', 'decade', 'century')
    and p_year >= 1
    and length(btrim(p_calendar)) between 1 and 50
    and case p_precision
      when 'day' then p_month between 1 and 12
        and p_day between 1 and case p_month
          when 2 then case
            when (case when p_era = 'bce' then 1 - p_year else p_year end) % 400 = 0
              or (
                (case when p_era = 'bce' then 1 - p_year else p_year end) % 4 = 0
                and (case when p_era = 'bce' then 1 - p_year else p_year end) % 100 <> 0
              ) then 29
            else 28
          end
          when 4 then 30
          when 6 then 30
          when 9 then 30
          when 11 then 30
          else 31
        end
      when 'month' then p_month between 1 and 12 and p_day is null
      when 'year' then p_month is null and p_day is null
      when 'decade' then p_year % 10 = 0 and p_month is null and p_day is null
      when 'century' then p_month is null and p_day is null
      else false
    end
  );
$$;

revoke all on function public.is_valid_extended_historical_date(text, text, integer, integer, integer, text) from public;
grant execute on function public.is_valid_extended_historical_date(text, text, integer, integer, integer, text) to anon, authenticated, service_role;

alter table public.timeline_items
  drop constraint if exists timeline_items_valid_dates_check,
  drop constraint if exists timeline_items_end_after_start_check;

alter table public.timeline_events
  drop constraint if exists timeline_events_valid_date_check,
  drop constraint if exists timeline_events_precision_check;

alter table public.timeline_items
  add column start_era text not null default 'ce',
  add column start_precision text,
  add column start_original_text text,
  add column start_calendar text not null default 'proleptic_gregorian',
  add column end_era text not null default 'ce',
  add column end_precision text,
  add column end_original_text text,
  add column end_calendar text not null default 'proleptic_gregorian';

update public.timeline_items set
  start_precision = case when start_day is not null then 'day'
    when start_month is not null then 'month' else 'year' end,
  end_precision = case when end_day is not null then 'day'
    when end_month is not null then 'month' else 'year' end;

alter table public.timeline_items
  alter column start_precision set not null,
  alter column start_precision set default 'year',
  alter column end_precision set not null,
  alter column end_precision set default 'year',
  add column start_normalized_min bigint generated always as
    (public.historical_date_sort_key(start_era, start_precision, start_year, start_month, start_day, 'start')) stored,
  add column start_normalized_max bigint generated always as
    (public.historical_date_sort_key(start_era, start_precision, start_year, start_month, start_day, 'end')) stored,
  add column end_normalized_min bigint generated always as
    (public.historical_date_sort_key(end_era, end_precision, end_year, end_month, end_day, 'start')) stored,
  add column end_normalized_max bigint generated always as
    (public.historical_date_sort_key(end_era, end_precision, end_year, end_month, end_day, 'end')) stored,
  add constraint timeline_items_extended_dates_check check (
    public.is_valid_extended_historical_date(start_era, start_precision, start_year, start_month, start_day, start_calendar)
    and public.is_valid_extended_historical_date(end_era, end_precision, end_year, end_month, end_day, end_calendar)
    and length(coalesce(start_original_text, '')) <= 200
    and length(coalesce(end_original_text, '')) <= 200
  ),
  add constraint timeline_items_end_after_start_check check (
    end_normalized_max is null or end_normalized_max >= start_normalized_min
  );

alter table public.timeline_events
  add column event_era text not null default 'ce',
  add column event_precision text,
  add column event_original_text text,
  add column event_calendar text not null default 'proleptic_gregorian';

update public.timeline_events set event_precision = case
  when event_day is not null then 'day'
  when event_month is not null then 'month'
  else 'year' end;

alter table public.timeline_events
  alter column event_precision set not null,
  alter column event_precision set default 'year',
  add column event_normalized_min bigint generated always as
    (public.historical_date_sort_key(event_era, event_precision, event_year, event_month, event_day, 'start')) stored,
  add column event_normalized_max bigint generated always as
    (public.historical_date_sort_key(event_era, event_precision, event_year, event_month, event_day, 'end')) stored,
  add constraint timeline_events_extended_date_check check (
    public.is_valid_extended_historical_date(event_era, event_precision, event_year, event_month, event_day, event_calendar)
    and length(coalesce(event_original_text, '')) <= 200
  );

alter table public.timeline_items
  alter column start_precision drop default,
  alter column end_precision drop default;
alter table public.timeline_events
  alter column event_precision drop default;

create function private.infer_historical_date_precision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'timeline_items' then
    if new.start_precision is null then
      new.start_precision := case when new.start_day is not null then 'day'
        when new.start_month is not null then 'month' else 'year' end;
    end if;
    if new.end_precision is null then
      new.end_precision := case when new.end_day is not null then 'day'
        when new.end_month is not null then 'month' else 'year' end;
    end if;
  else
    if new.event_precision is null then
      new.event_precision := case when new.event_day is not null then 'day'
        when new.event_month is not null then 'month' else 'year' end;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.infer_historical_date_precision() from public;
create trigger timeline_items_infer_historical_date_precision
before insert or update on public.timeline_items
for each row execute function private.infer_historical_date_precision();
create trigger timeline_events_infer_historical_date_precision
before insert or update on public.timeline_events
for each row execute function private.infer_historical_date_precision();

create index timeline_items_normalized_range_idx
on public.timeline_items (project_id, start_normalized_min, end_normalized_max);
create index timeline_events_normalized_range_idx
on public.timeline_events (project_id, event_normalized_min, event_normalized_max);

alter table public.search_documents
  add column start_era text,
  add column start_precision text,
  add column start_original_text text,
  add column start_calendar text,
  add column end_era text,
  add column end_precision text,
  add column end_original_text text,
  add column end_calendar text,
  add column normalized_min bigint,
  add column normalized_max bigint;

create index search_documents_normalized_range_idx
on public.search_documents (project_id, normalized_min, normalized_max);

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
    concat_ws(E'\n', new.title, new.description, new.source_text,
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
    concat_ws(E'\n', new.title, new.description, new.source_text,
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

drop function public.search_global_documents(text, text, integer, integer);
create function public.search_global_documents(
  p_query text,
  p_entity_type text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  entity_type text, entity_id uuid, project_id uuid, title text,
  project_name text, content text, detail_path text,
  start_year integer, start_month integer, start_day integer,
  start_era text, start_precision text, start_original_text text,
  start_calendar text, end_year integer, end_month integer, end_day integer,
  end_era text, end_precision text, end_original_text text,
  end_calendar text, end_date_status text, is_start_approximate boolean,
  is_end_approximate boolean, normalized_min bigint, normalized_max bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select document.entity_type, document.entity_id, document.project_id,
    document.title, document.project_name, document.content,
    document.detail_path, document.start_year, document.start_month,
    document.start_day, document.start_era, document.start_precision,
    document.start_original_text, document.start_calendar,
    document.end_year, document.end_month, document.end_day,
    document.end_era, document.end_precision, document.end_original_text,
    document.end_calendar, document.end_date_status,
    document.is_start_approximate, document.is_end_approximate,
    document.normalized_min, document.normalized_max, count(*) over ()
  from public.search_documents as document
  where length(btrim(p_query)) > 0
    and document.content operator(extensions.&@~)
      extensions.pgroonga_query_escape(btrim(p_query))
    and (p_entity_type is null or document.entity_type = p_entity_type)
  order by document.normalized_min nulls last, document.updated_at desc,
    document.entity_type, document.entity_id
  limit least(greatest(p_page_size, 1), 50)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 50);
$$;

revoke all on function public.search_global_documents(text, text, integer, integer) from public;
grant execute on function public.search_global_documents(text, text, integer, integer) to anon, authenticated;

create or replace function public.create_timeline_item_with_events(
  p_project_id uuid,
  p_item jsonb,
  p_events jsonb default '[]'::jsonb
)
returns table (item_id uuid, created_event_ids uuid[], failed_events jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_id uuid;
  v_manual_order integer;
  v_event jsonb;
  v_event_id uuid;
  v_event_title text;
  v_created_event_ids uuid[] := array[]::uuid[];
  v_failed_events jsonb := '[]'::jsonb;
  v_failure_reason text;
begin
  if jsonb_typeof(p_item) <> 'object' then
    raise invalid_parameter_value using message = 'Timeline item payload must be an object';
  end if;
  if jsonb_typeof(p_events) <> 'array' then
    raise invalid_parameter_value using message = 'Timeline event payload must be an array';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  select coalesce(max(manual_order), -1) + 1 into v_manual_order
  from public.timeline_items where project_id = p_project_id;

  insert into public.timeline_items (
    project_id, type_id, title, description, source_text, external_url,
    temporal_type, color_override, manual_order, is_visible,
    start_year, start_month, start_day, start_era, start_precision,
    start_original_text, start_calendar, is_start_approximate,
    start_uncertainty_years, end_date_status, end_year, end_month, end_day,
    end_era, end_precision, end_original_text, end_calendar,
    is_end_approximate, end_uncertainty_years, is_point_approximate
  ) values (
    p_project_id, (p_item ->> 'type_id')::uuid, p_item ->> 'title',
    p_item ->> 'description', p_item ->> 'source_text',
    p_item ->> 'external_url', p_item ->> 'temporal_type',
    p_item ->> 'color_override', v_manual_order,
    coalesce((p_item ->> 'is_visible')::boolean, true),
    (p_item ->> 'start_year')::integer, (p_item ->> 'start_month')::integer,
    (p_item ->> 'start_day')::integer, coalesce(p_item ->> 'start_era', 'ce'),
    coalesce(p_item ->> 'start_precision', case
      when p_item ->> 'start_day' is not null then 'day'
      when p_item ->> 'start_month' is not null then 'month' else 'year' end),
    p_item ->> 'start_original_text',
    coalesce(p_item ->> 'start_calendar', 'proleptic_gregorian'),
    coalesce((p_item ->> 'is_start_approximate')::boolean, false),
    (p_item ->> 'start_uncertainty_years')::integer,
    p_item ->> 'end_date_status', (p_item ->> 'end_year')::integer,
    (p_item ->> 'end_month')::integer, (p_item ->> 'end_day')::integer,
    coalesce(p_item ->> 'end_era', 'ce'),
    coalesce(p_item ->> 'end_precision', case
      when p_item ->> 'end_day' is not null then 'day'
      when p_item ->> 'end_month' is not null then 'month' else 'year' end),
    p_item ->> 'end_original_text',
    coalesce(p_item ->> 'end_calendar', 'proleptic_gregorian'),
    coalesce((p_item ->> 'is_end_approximate')::boolean, false),
    (p_item ->> 'end_uncertainty_years')::integer,
    coalesce((p_item ->> 'is_point_approximate')::boolean, false)
  ) returning id into v_item_id;

  for v_event in select value from jsonb_array_elements(p_events) loop
    v_event_title := coalesce(nullif(btrim(v_event ->> 'title'), ''), 'タイトル未入力');
    begin
      insert into public.timeline_events (
        project_id, timeline_item_id, title, event_year, event_month,
        event_day, event_era, event_precision, event_original_text,
        event_calendar, is_approximate, description, source_text, external_url
      ) values (
        p_project_id, v_item_id, v_event ->> 'title',
        (v_event ->> 'event_year')::integer,
        (v_event ->> 'event_month')::integer,
        (v_event ->> 'event_day')::integer,
        coalesce(v_event ->> 'event_era', 'ce'),
        coalesce(v_event ->> 'event_precision', case
          when v_event ->> 'event_day' is not null then 'day'
          when v_event ->> 'event_month' is not null then 'month' else 'year' end),
        v_event ->> 'event_original_text',
        coalesce(v_event ->> 'event_calendar', 'proleptic_gregorian'),
        coalesce((v_event ->> 'is_approximate')::boolean, false),
        v_event ->> 'description', v_event ->> 'source_text',
        v_event ->> 'external_url'
      ) returning id into v_event_id;
      v_created_event_ids := array_append(v_created_event_ids, v_event_id);
    exception when others then
      v_failure_reason := case sqlstate
        when '23514' then '入力内容がデータベース制約を満たしていません。'
        when '23503' then '親タイムラインアイテムを確認できませんでした。'
        when '42501' then 'イベントアイテムを追加する権限がありません。'
        when '22P02' then '入力形式を確認してください。'
        when '22003' then '数値が許容範囲を超えています。'
        else 'イベントアイテムを追加できませんでした。'
      end;
      v_failed_events := v_failed_events || jsonb_build_array(
        jsonb_build_object('title', v_event_title, 'reason', v_failure_reason)
      );
    end;
  end loop;
  return query select v_item_id, v_created_event_ids, v_failed_events;
end;
$$;

insert into private.application_schema_versions (version, name, baseline_migration)
values (2, 'historical-date-model', '20260726151016_phase_l1_historical_dates.sql');

alter function public.import_project_data(uuid, text, jsonb)
rename to import_project_data_v1;
revoke all on function public.import_project_data_v1(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_project_data_v1(uuid, text, jsonb) to authenticated;

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
  v_destination_id uuid;
  v_sections jsonb := coalesce(
    p_payload -> 'importSections',
    '["itemTypes","timelineItems","timelineEvents"]'::jsonb
  );
  v_legacy_sections jsonb := case when v_sections ? 'itemTypes'
    then '["itemTypes"]'::jsonb else '[]'::jsonb end;
  v_item jsonb;
  v_event jsonb;
  v_source_id uuid;
  v_type_id uuid;
  v_item_id uuid;
  v_parent_id uuid;
  v_item_map jsonb := '{}'::jsonb;
begin
  v_destination_id := public.import_project_data_v1(
    p_target_project_id,
    p_mode,
    jsonb_set(p_payload, '{importSections}', v_legacy_sections, true)
  );

  if v_sections ? 'timelineItems' then
    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'timelineItems', '[]'::jsonb)) loop
      v_source_id := (v_item ->> 'id')::uuid;
      select destination_type.id into v_type_id
      from public.timeline_item_types as destination_type
      left join lateral (
        select source_type.value ->> 'name' as name
        from jsonb_array_elements(coalesce(p_payload -> 'itemTypes', '[]'::jsonb)) as source_type(value)
        where source_type.value ->> 'id' = v_item ->> 'typeId'
        limit 1
      ) as source_type on true
      where destination_type.project_id = v_destination_id
        and (
          destination_type.id = (v_item ->> 'typeId')::uuid
          or destination_type.normalized_name = lower(regexp_replace(btrim(source_type.name), '\s+', ' ', 'g'))
        )
      order by (destination_type.id = (v_item ->> 'typeId')::uuid) desc
      limit 1;
      if v_type_id is null then
        raise foreign_key_violation using message = 'Unknown item type';
      end if;

      v_item_id := null;
      if p_mode = 'append' then
        select id into v_item_id from public.timeline_items
        where id = v_source_id and project_id = v_destination_id;
      end if;
      if v_item_id is null then v_item_id := gen_random_uuid(); end if;

      insert into public.timeline_items (
        id, project_id, type_id, title, description, source_text, external_url,
        temporal_type, color_override, manual_order, is_visible,
        start_year, start_month, start_day, start_era, start_precision,
        start_original_text, start_calendar, is_start_approximate,
        start_uncertainty_years, end_date_status, end_year, end_month, end_day,
        end_era, end_precision, end_original_text, end_calendar,
        is_end_approximate, end_uncertainty_years, is_point_approximate
      ) values (
        v_item_id, v_destination_id, v_type_id, v_item ->> 'title',
        nullif(v_item ->> 'description', ''), nullif(v_item ->> 'sourceText', ''),
        nullif(v_item ->> 'externalUrl', ''), v_item ->> 'temporalType',
        nullif(v_item ->> 'colorOverride', ''), (v_item ->> 'manualOrder')::integer,
        coalesce((v_item ->> 'isVisible')::boolean, true),
        case when v_item ->> 'temporalType' = 'point'
          then (v_item #>> '{point,year}')::integer else (v_item #>> '{start,year}')::integer end,
        case when v_item ->> 'temporalType' = 'point'
          then nullif(v_item #>> '{point,month}', '')::integer else nullif(v_item #>> '{start,month}', '')::integer end,
        case when v_item ->> 'temporalType' = 'point'
          then nullif(v_item #>> '{point,day}', '')::integer else nullif(v_item #>> '{start,day}', '')::integer end,
        coalesce(case when v_item ->> 'temporalType' = 'point'
          then v_item #>> '{point,era}' else v_item #>> '{start,era}' end, 'ce'),
        coalesce(case when v_item ->> 'temporalType' = 'point'
          then v_item #>> '{point,precision}' else v_item #>> '{start,precision}' end, 'year'),
        nullif(case when v_item ->> 'temporalType' = 'point'
          then v_item #>> '{point,originalText}' else v_item #>> '{start,originalText}' end, ''),
        coalesce(case when v_item ->> 'temporalType' = 'point'
          then v_item #>> '{point,calendar}' else v_item #>> '{start,calendar}' end, 'proleptic_gregorian'),
        coalesce((v_item ->> 'isStartApproximate')::boolean, false),
        nullif(v_item ->> 'startUncertaintyYears', '')::integer,
        nullif(v_item ->> 'endDateStatus', ''),
        case when v_item ->> 'endDateStatus' = 'unknown'
          then nullif(v_item #>> '{lastConfirmed,year}', '')::integer else nullif(v_item #>> '{end,year}', '')::integer end,
        case when v_item ->> 'endDateStatus' = 'unknown'
          then nullif(v_item #>> '{lastConfirmed,month}', '')::integer else nullif(v_item #>> '{end,month}', '')::integer end,
        case when v_item ->> 'endDateStatus' = 'unknown'
          then nullif(v_item #>> '{lastConfirmed,day}', '')::integer else nullif(v_item #>> '{end,day}', '')::integer end,
        coalesce(case when v_item ->> 'endDateStatus' = 'unknown'
          then v_item #>> '{lastConfirmed,era}' else v_item #>> '{end,era}' end, 'ce'),
        coalesce(case when v_item ->> 'endDateStatus' = 'unknown'
          then v_item #>> '{lastConfirmed,precision}' else v_item #>> '{end,precision}' end, 'year'),
        nullif(case when v_item ->> 'endDateStatus' = 'unknown'
          then v_item #>> '{lastConfirmed,originalText}' else v_item #>> '{end,originalText}' end, ''),
        coalesce(case when v_item ->> 'endDateStatus' = 'unknown'
          then v_item #>> '{lastConfirmed,calendar}' else v_item #>> '{end,calendar}' end, 'proleptic_gregorian'),
        coalesce((v_item ->> 'isEndApproximate')::boolean, false),
        nullif(v_item ->> 'endUncertaintyYears', '')::integer,
        coalesce((v_item ->> 'isPointApproximate')::boolean, false)
      )
      on conflict (id) do update set
        type_id = excluded.type_id, title = excluded.title,
        description = excluded.description, source_text = excluded.source_text,
        external_url = excluded.external_url, temporal_type = excluded.temporal_type,
        color_override = excluded.color_override, manual_order = excluded.manual_order,
        is_visible = excluded.is_visible, start_year = excluded.start_year,
        start_month = excluded.start_month, start_day = excluded.start_day,
        start_era = excluded.start_era, start_precision = excluded.start_precision,
        start_original_text = excluded.start_original_text,
        start_calendar = excluded.start_calendar,
        is_start_approximate = excluded.is_start_approximate,
        start_uncertainty_years = excluded.start_uncertainty_years,
        end_date_status = excluded.end_date_status, end_year = excluded.end_year,
        end_month = excluded.end_month, end_day = excluded.end_day,
        end_era = excluded.end_era, end_precision = excluded.end_precision,
        end_original_text = excluded.end_original_text,
        end_calendar = excluded.end_calendar,
        is_end_approximate = excluded.is_end_approximate,
        end_uncertainty_years = excluded.end_uncertainty_years,
        is_point_approximate = excluded.is_point_approximate;
      v_item_map := v_item_map || jsonb_build_object(v_source_id::text, v_item_id::text);
    end loop;
  end if;

  if v_sections ? 'timelineEvents' then
    for v_event in select value from jsonb_array_elements(coalesce(p_payload -> 'timelineEvents', '[]'::jsonb)) loop
      v_source_id := (v_event ->> 'id')::uuid;
      v_parent_id := nullif(v_item_map ->> (v_event ->> 'timelineItemId'), '')::uuid;
      if v_parent_id is null then
        select id into v_parent_id from public.timeline_items
        where id = (v_event ->> 'timelineItemId')::uuid and project_id = v_destination_id;
      end if;
      if v_parent_id is null then raise foreign_key_violation using message = 'Unknown event parent'; end if;
      v_item_id := null;
      if p_mode = 'append' then
        select id into v_item_id from public.timeline_events
        where id = v_source_id and project_id = v_destination_id;
      end if;
      if v_item_id is null then v_item_id := gen_random_uuid(); end if;

      insert into public.timeline_events (
        id, project_id, timeline_item_id, title, event_year, event_month,
        event_day, event_era, event_precision, event_original_text,
        event_calendar, is_approximate, description, source_text, external_url
      ) values (
        v_item_id, v_destination_id, v_parent_id, v_event ->> 'title',
        (v_event #>> '{date,year}')::integer,
        nullif(v_event #>> '{date,month}', '')::integer,
        nullif(v_event #>> '{date,day}', '')::integer,
        coalesce(v_event #>> '{date,era}', 'ce'),
        coalesce(v_event #>> '{date,precision}', 'year'),
        nullif(v_event #>> '{date,originalText}', ''),
        coalesce(v_event #>> '{date,calendar}', 'proleptic_gregorian'),
        coalesce((v_event ->> 'isApproximate')::boolean, false),
        nullif(v_event ->> 'description', ''), nullif(v_event ->> 'sourceText', ''),
        nullif(v_event ->> 'externalUrl', '')
      )
      on conflict (id) do update set
        timeline_item_id = excluded.timeline_item_id, title = excluded.title,
        event_year = excluded.event_year, event_month = excluded.event_month,
        event_day = excluded.event_day, event_era = excluded.event_era,
        event_precision = excluded.event_precision,
        event_original_text = excluded.event_original_text,
        event_calendar = excluded.event_calendar,
        is_approximate = excluded.is_approximate,
        description = excluded.description, source_text = excluded.source_text,
        external_url = excluded.external_url;
    end loop;
  end if;
  return v_destination_id;
end;
$$;

comment on function public.import_project_data(uuid, text, jsonb) is
'Imports schema v2 historical date metadata while delegating project and item-type compatibility to the v1 implementation.';
revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb) to authenticated;
