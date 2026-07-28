alter table public.timeline_items
add column aliases text[] not null default '{}'::text[];

alter table public.timeline_events
add column aliases text[] not null default '{}'::text[];

create function private.valid_entity_aliases(p_aliases text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select cardinality(p_aliases) <= 20
    and not exists (
      select 1 from unnest(p_aliases) as alias(value)
      where length(btrim(alias.value)) not between 1 and 200
    )
    and cardinality(p_aliases) = (
      select count(distinct lower(btrim(alias.value)))
      from unnest(p_aliases) as alias(value)
    );
$$;

alter table public.timeline_items
add constraint timeline_items_aliases_check
check (private.valid_entity_aliases(aliases));

alter table public.timeline_events
add constraint timeline_events_aliases_check
check (private.valid_entity_aliases(aliases));

insert into private.application_schema_versions (version, name, baseline_migration)
values (3, 'internal-links-aliases', '20260728131644_phase_l6_internal_links_aliases.sql');

-- Keep item creation and its nested events atomic while accepting L6 aliases.
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
    project_id, type_id, title, aliases, description, source_text, external_url,
    temporal_type, color_override, manual_order, is_visible,
    start_year, start_month, start_day, start_era, start_precision,
    start_original_text, start_calendar, is_start_approximate,
    start_uncertainty_years, end_date_status, end_year, end_month, end_day,
    end_era, end_precision, end_original_text, end_calendar,
    is_end_approximate, end_uncertainty_years, is_point_approximate
  ) values (
    p_project_id, (p_item ->> 'type_id')::uuid, p_item ->> 'title',
    array(select jsonb_array_elements_text(coalesce(p_item -> 'aliases', '[]'::jsonb))),
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
        project_id, timeline_item_id, title, aliases, event_year, event_month,
        event_day, event_era, event_precision, event_original_text,
        event_calendar, is_approximate, description, source_text, external_url
      ) values (
        p_project_id, v_item_id, v_event ->> 'title',
        array(select jsonb_array_elements_text(coalesce(v_event -> 'aliases', '[]'::jsonb))),
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

create table public.internal_links (
  project_id uuid not null references public.projects (id) on delete cascade,
  source_entity_type text not null check (
    source_entity_type in ('timeline_item', 'timeline_event')
  ),
  source_entity_id uuid not null,
  target_entity_type text not null check (
    target_entity_type in ('timeline_item', 'timeline_event')
  ),
  target_entity_id uuid not null,
  primary key (
    project_id,
    source_entity_type,
    source_entity_id,
    target_entity_type,
    target_entity_id
  )
);

comment on table public.internal_links is
'Compact reverse index extracted from Markdown. The Markdown body remains the only full-text copy.';

create index internal_links_target_idx
on public.internal_links (project_id, target_entity_type, target_entity_id);

alter table public.internal_links enable row level security;

create policy "Project owners can read internal links"
on public.internal_links for select
to authenticated
using (
  exists (
    select 1 from public.projects as project
    where project.id = internal_links.project_id
      and project.owner_id = (select auth.uid())
  )
);

revoke all on table public.internal_links from anon, authenticated;
grant select on table public.internal_links to authenticated;
grant all on table public.internal_links to service_role;

create function private.sync_internal_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_match text[];
  source_type text := case tg_table_name
    when 'timeline_items' then 'timeline_item'
    else 'timeline_event'
  end;
begin
  delete from public.internal_links
  where project_id = new.project_id
    and source_entity_type = source_type
    and source_entity_id = new.id;

  if new.deleted_at is not null or new.description is null then
    return new;
  end if;

  for link_match in
    select regexp_matches(
      new.description,
      '\[\[(item|event):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\|[^\]\r\n]+\]\]',
      'g'
    )
  loop
    insert into public.internal_links (
      project_id, source_entity_type, source_entity_id,
      target_entity_type, target_entity_id
    ) values (
      new.project_id, source_type, new.id,
      case link_match[1] when 'item' then 'timeline_item' else 'timeline_event' end,
      link_match[2]::uuid
    ) on conflict do nothing;
  end loop;
  return new;
end;
$$;

revoke all on function private.sync_internal_links() from public;

create trigger timeline_items_sync_internal_links
after insert or update of description, deleted_at on public.timeline_items
for each row execute function private.sync_internal_links();

create trigger timeline_events_sync_internal_links
after insert or update of description, deleted_at on public.timeline_events
for each row execute function private.sync_internal_links();

create function private.sync_alias_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_type text := case tg_table_name
    when 'timeline_items' then 'timeline_item'
    else 'timeline_event'
  end;
begin
  update public.search_documents
  set content = concat_ws(E'\n', content, array_to_string(new.aliases, E'\n'))
  where search_documents.entity_type = v_entity_type
    and search_documents.entity_id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_alias_search_document() from public;

create trigger zz_timeline_items_sync_alias_search
after insert or update of aliases on public.timeline_items
for each row execute function private.sync_alias_search_document();

create trigger zz_timeline_events_sync_alias_search
after insert or update of aliases on public.timeline_events
for each row execute function private.sync_alias_search_document();

create function public.get_internal_link_candidates(
  p_project_id uuid,
  p_query text default ''
)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  aliases text[],
  kind_label text,
  date_label text,
  parent_title text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select
      'item'::text as entity_type,
      item.id as entity_id,
      item.title,
      item.aliases,
      item_type.name as kind_label,
      concat_ws('/', item.start_year::text, item.start_month::text, item.start_day::text) as date_label,
      null::text as parent_title,
      item.updated_at
    from public.timeline_items as item
    join public.timeline_item_types as item_type on item_type.id = item.type_id
    where item.project_id = p_project_id
      and item.deleted_at is null
      and (
        btrim(p_query) = ''
        or item.title ilike '%' || btrim(p_query) || '%'
        or exists (
          select 1 from unnest(item.aliases) as alias(value)
          where alias.value ilike '%' || btrim(p_query) || '%'
        )
      )
    union all
    select
      'event'::text,
      event.id,
      event.title,
      event.aliases,
      'イベント'::text,
      concat_ws('/', event.event_year::text, event.event_month::text, event.event_day::text),
      parent.title,
      event.updated_at
    from public.timeline_events as event
    join public.timeline_items as parent on parent.id = event.timeline_item_id
    where event.project_id = p_project_id
      and event.deleted_at is null
      and parent.deleted_at is null
      and (
        btrim(p_query) = ''
        or event.title ilike '%' || btrim(p_query) || '%'
        or exists (
          select 1 from unnest(event.aliases) as alias(value)
          where alias.value ilike '%' || btrim(p_query) || '%'
        )
      )
  )
  select entity_type, entity_id, title, aliases, kind_label,
    nullif(date_label, ''), parent_title
  from candidates
  order by title, entity_type, updated_at desc, entity_id
  limit 20;
$$;

create function public.resolve_internal_links(
  p_project_id uuid,
  p_item_ids uuid[] default '{}'::uuid[],
  p_event_ids uuid[] default '{}'::uuid[]
)
returns table (entity_type text, entity_id uuid, title text)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'item'::text, item.id, item.title
  from public.timeline_items as item
  where item.project_id = p_project_id
    and item.id = any(p_item_ids)
    and item.deleted_at is null
  union all
  select 'event'::text, event.id, event.title
  from public.timeline_events as event
  join public.timeline_items as parent on parent.id = event.timeline_item_id
  where event.project_id = p_project_id
    and event.id = any(p_event_ids)
    and event.deleted_at is null
    and parent.deleted_at is null;
$$;

revoke all on function public.get_internal_link_candidates(uuid, text) from public;
revoke all on function public.resolve_internal_links(uuid, uuid[], uuid[]) from public;
grant execute on function public.get_internal_link_candidates(uuid, text) to anon, authenticated;
grant execute on function public.resolve_internal_links(uuid, uuid[], uuid[]) to anon, authenticated;

insert into public.internal_links (
  project_id, source_entity_type, source_entity_id,
  target_entity_type, target_entity_id
)
select item.project_id, 'timeline_item', item.id,
  case found.value[1] when 'item' then 'timeline_item' else 'timeline_event' end,
  found.value[2]::uuid
from public.timeline_items as item
cross join lateral regexp_matches(
  coalesce(item.description, ''),
  '\[\[(item|event):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\|[^\]\r\n]+\]\]',
  'g'
) as found(value)
where item.deleted_at is null
on conflict do nothing;

create function private.remap_internal_link_ids(
  p_content text,
  p_item_map jsonb,
  p_event_map jsonb
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  result text := p_content;
  source_id text;
  destination_id text;
begin
  if result is null then return null; end if;
  for source_id, destination_id in select key, value from jsonb_each_text(p_item_map)
  loop
    result := replace(
      result,
      '[[item:' || source_id || '|',
      '[[item:' || destination_id || '|'
    );
  end loop;
  for source_id, destination_id in select key, value from jsonb_each_text(p_event_map)
  loop
    result := replace(
      result,
      '[[event:' || source_id || '|',
      '[[event:' || destination_id || '|'
    );
  end loop;
  return result;
end;
$$;

alter function public.import_project_data(uuid, text, jsonb)
rename to import_project_data_without_link_remap;

revoke all on function public.import_project_data_without_link_remap(uuid, text, jsonb)
from public;
grant execute on function public.import_project_data_without_link_remap(uuid, text, jsonb)
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
  item_map jsonb := '{}'::jsonb;
  event_map jsonb := '{}'::jsonb;
  source_row jsonb;
  source_id uuid;
  mapped_id uuid;
begin
  if p_payload ? 'timelineItems' then
    marked_payload := jsonb_set(
      marked_payload,
      '{timelineItems}',
      coalesce((
        select jsonb_agg(
          jsonb_set(
            item.value,
            '{externalUrl}',
            to_jsonb('urn:timeline-editor-import:item:' || (item.value ->> 'id'))
          )
        )
        from jsonb_array_elements(p_payload -> 'timelineItems') as item(value)
      ), '[]'::jsonb)
    );
  end if;
  if p_payload ? 'timelineEvents' then
    marked_payload := jsonb_set(
      marked_payload,
      '{timelineEvents}',
      coalesce((
        select jsonb_agg(
          jsonb_set(
            event.value,
            '{externalUrl}',
            to_jsonb('urn:timeline-editor-import:event:' || (event.value ->> 'id'))
          )
        )
        from jsonb_array_elements(p_payload -> 'timelineEvents') as event(value)
      ), '[]'::jsonb)
    );
  end if;

  destination_id := public.import_project_data_without_link_remap(
    p_target_project_id,
    p_mode,
    marked_payload
  );

  select coalesce(jsonb_object_agg(
    substring(item.external_url from length('urn:timeline-editor-import:item:') + 1),
    item.id::text
  ), '{}'::jsonb)
  into item_map
  from public.timeline_items as item
  where item.project_id = destination_id
    and item.external_url like 'urn:timeline-editor-import:item:%';

  select coalesce(jsonb_object_agg(
    substring(event.external_url from length('urn:timeline-editor-import:event:') + 1),
    event.id::text
  ), '{}'::jsonb)
  into event_map
  from public.timeline_events as event
  where event.project_id = destination_id
    and event.external_url like 'urn:timeline-editor-import:event:%';

  for source_row in
    select value from jsonb_array_elements(coalesce(p_payload -> 'timelineItems', '[]'::jsonb))
  loop
    source_id := (source_row ->> 'id')::uuid;
    mapped_id := nullif(item_map ->> source_id::text, '')::uuid;
    if mapped_id is not null then
      update public.timeline_items set
        aliases = array(
          select jsonb_array_elements_text(coalesce(source_row -> 'aliases', '[]'::jsonb))
        ),
        external_url = nullif(source_row ->> 'externalUrl', ''),
        description = private.remap_internal_link_ids(
          nullif(source_row ->> 'description', ''), item_map, event_map
        )
      where project_id = destination_id and id = mapped_id;
    end if;
  end loop;

  for source_row in
    select value from jsonb_array_elements(coalesce(p_payload -> 'timelineEvents', '[]'::jsonb))
  loop
    source_id := (source_row ->> 'id')::uuid;
    mapped_id := nullif(event_map ->> source_id::text, '')::uuid;
    if mapped_id is not null then
      update public.timeline_events set
        aliases = array(
          select jsonb_array_elements_text(coalesce(source_row -> 'aliases', '[]'::jsonb))
        ),
        external_url = nullif(source_row ->> 'externalUrl', ''),
        description = private.remap_internal_link_ids(
          nullif(source_row ->> 'description', ''), item_map, event_map
        )
      where project_id = destination_id and id = mapped_id;
    end if;
  end loop;

  return destination_id;
end;
$$;

revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb) to authenticated;

insert into public.internal_links (
  project_id, source_entity_type, source_entity_id,
  target_entity_type, target_entity_id
)
select event.project_id, 'timeline_event', event.id,
  case found.value[1] when 'item' then 'timeline_item' else 'timeline_event' end,
  found.value[2]::uuid
from public.timeline_events as event
cross join lateral regexp_matches(
  coalesce(event.description, ''),
  '\[\[(item|event):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\|[^\]\r\n]+\]\]',
  'g'
) as found(value)
where event.deleted_at is null
on conflict do nothing;
