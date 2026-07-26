alter table public.timeline_items
  drop constraint if exists timeline_items_last_confirmed_precision_check,
  drop constraint if exists timeline_items_point_precision_check,
  drop constraint if exists timeline_items_valid_dates_check,
  drop constraint if exists timeline_items_end_after_start_check,
  drop constraint if exists timeline_items_last_confirmed_after_start_check,
  drop constraint if exists timeline_items_temporal_shape_check,
  drop constraint if exists timeline_items_end_status_shape_check;

update public.timeline_items
set
  start_year = point_year,
  start_month = point_month,
  start_day = point_day
where temporal_type = 'point';

update public.timeline_items
set
  end_year = last_confirmed_year,
  end_month = last_confirmed_month,
  end_day = last_confirmed_day
where temporal_type = 'range' and end_date_status = 'unknown';

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
  select * into strict project_row
  from public.projects
  where id = new.project_id;

  select name into strict type_name
  from public.timeline_item_types
  where id = new.type_id and project_id = new.project_id;

  insert into public.search_documents (
    entity_type, entity_id, project_id, owner_id, is_public, title,
    project_name, content, detail_path, start_year, start_month, start_day,
    end_year, end_month, end_day, end_date_status, is_start_approximate,
    is_end_approximate, updated_at
  ) values (
    'timeline_item', new.id, new.project_id, project_row.owner_id,
    project_row.visibility = 'public', new.title, project_row.name,
    concat_ws(E'\n', new.title, new.description, new.source_text,
      new.external_url, type_name),
    '/projects/' || new.project_id::text || '/items/' || new.id::text,
    new.start_year, new.start_month, new.start_day,
    new.end_year, new.end_month, new.end_day, new.end_date_status,
    case when new.temporal_type = 'point'
      then new.is_point_approximate else new.is_start_approximate end,
    new.is_end_approximate, new.updated_at
  )
  on conflict (entity_type, entity_id) do update set
    project_id = excluded.project_id,
    owner_id = excluded.owner_id,
    is_public = excluded.is_public,
    title = excluded.title,
    project_name = excluded.project_name,
    content = excluded.content,
    detail_path = excluded.detail_path,
    start_year = excluded.start_year,
    start_month = excluded.start_month,
    start_day = excluded.start_day,
    end_year = excluded.end_year,
    end_month = excluded.end_month,
    end_day = excluded.end_day,
    end_date_status = excluded.end_date_status,
    is_start_approximate = excluded.is_start_approximate,
    is_end_approximate = excluded.is_end_approximate,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

alter table public.timeline_items
  drop column if exists last_confirmed_year,
  drop column if exists last_confirmed_month,
  drop column if exists last_confirmed_day,
  drop column if exists point_year,
  drop column if exists point_month,
  drop column if exists point_day;

alter table public.timeline_items
  add constraint timeline_items_valid_dates_check check (
    public.is_valid_historical_date(start_year, start_month, start_day)
    and public.is_valid_historical_date(end_year, end_month, end_day)
  ),
  add constraint timeline_items_end_after_start_check check (
    end_year is null
    or end_year * 372 + coalesce(end_month, 12) * 31 + coalesce(end_day, 31)
      >= start_year * 372 + coalesce(start_month, 1) * 31 + coalesce(start_day, 1)
  ),
  add constraint timeline_items_temporal_shape_check check (
    start_year is not null
    and (
      (
        temporal_type = 'range'
        and end_date_status is not null
        and is_point_approximate = false
      )
      or (
        temporal_type = 'point'
        and is_start_approximate = false
        and start_uncertainty_years is null
        and end_date_status is null
        and end_year is null
        and end_month is null
        and end_day is null
        and is_end_approximate = false
        and end_uncertainty_years is null
      )
    )
  ),
  add constraint timeline_items_end_status_shape_check check (
    temporal_type = 'point'
    or (
      end_date_status = 'specified'
      and end_year is not null
    )
    or (
      end_date_status = 'ongoing'
      and end_year is null
      and end_month is null
      and end_day is null
      and is_end_approximate = false
      and end_uncertainty_years is null
    )
    or (
      end_date_status = 'unknown'
      and is_end_approximate = false
      and end_uncertainty_years is null
    )
  );

create or replace function public.create_timeline_item_with_events(
  p_project_id uuid,
  p_item jsonb,
  p_events jsonb default '[]'::jsonb
)
returns table (
  item_id uuid,
  created_event_ids uuid[],
  failed_events jsonb
)
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
    start_year, start_month, start_day, is_start_approximate,
    start_uncertainty_years, end_date_status, end_year, end_month, end_day,
    is_end_approximate, end_uncertainty_years, is_point_approximate
  ) values (
    p_project_id, (p_item ->> 'type_id')::uuid, p_item ->> 'title',
    p_item ->> 'description', p_item ->> 'source_text',
    p_item ->> 'external_url', p_item ->> 'temporal_type',
    p_item ->> 'color_override', v_manual_order,
    coalesce((p_item ->> 'is_visible')::boolean, true),
    (p_item ->> 'start_year')::integer,
    (p_item ->> 'start_month')::integer,
    (p_item ->> 'start_day')::integer,
    coalesce((p_item ->> 'is_start_approximate')::boolean, false),
    (p_item ->> 'start_uncertainty_years')::integer,
    p_item ->> 'end_date_status',
    (p_item ->> 'end_year')::integer,
    (p_item ->> 'end_month')::integer,
    (p_item ->> 'end_day')::integer,
    coalesce((p_item ->> 'is_end_approximate')::boolean, false),
    (p_item ->> 'end_uncertainty_years')::integer,
    coalesce((p_item ->> 'is_point_approximate')::boolean, false)
  ) returning id into v_item_id;

  for v_event in select value from jsonb_array_elements(p_events) loop
    v_event_title := coalesce(nullif(btrim(v_event ->> 'title'), ''), 'タイトル未入力');
    begin
      insert into public.timeline_events (
        project_id, timeline_item_id, title, event_year, event_month,
        event_day, is_approximate, description, source_text, external_url
      ) values (
        p_project_id, v_item_id, v_event ->> 'title',
        (v_event ->> 'event_year')::integer,
        (v_event ->> 'event_month')::integer,
        (v_event ->> 'event_day')::integer,
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

comment on function public.create_timeline_item_with_events(uuid, jsonb, jsonb)
is 'Creates the parent item first, then isolates each child event insert so event failures do not roll back the parent or successful siblings.';

revoke all on function public.create_timeline_item_with_events(uuid, jsonb, jsonb) from public;
grant execute on function public.create_timeline_item_with_events(uuid, jsonb, jsonb) to authenticated, service_role;

comment on column public.timeline_items.start_year is
'The stored date year for both range starts and point items.';
comment on column public.timeline_items.end_year is
'The stored date year for specified range ends and optional last-confirmed dates when end_date_status is unknown.';

create or replace function public.import_project_data(
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
  v_owner_id uuid := (select auth.uid());
  v_type jsonb;
  v_item jsonb;
  v_event jsonb;
  v_source_id uuid;
  v_mapped_id uuid;
  v_type_id uuid;
  v_parent_id uuid;
  v_type_map jsonb := '{}'::jsonb;
  v_item_map jsonb := '{}'::jsonb;
  v_sections jsonb := coalesce(p_payload -> 'importSections', '["itemTypes","timelineItems","timelineEvents"]'::jsonb);
begin
  if v_owner_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_mode not in ('create', 'duplicate', 'overwrite', 'append') then
    raise check_violation using message = 'Unsupported import mode';
  end if;
  if p_mode in ('overwrite', 'append') and not exists (
    select 1 from public.projects
    where id = p_target_project_id and owner_id = v_owner_id
  ) then
    raise no_data_found using message = 'Project not found';
  end if;

  if p_mode in ('create', 'duplicate') then
    insert into public.projects (owner_id, name, description)
    values (
      v_owner_id,
      left(btrim(p_payload #>> '{project,name}') || case when p_mode = 'duplicate' then ' (コピー)' else '' end, 200),
      nullif(p_payload #>> '{project,description}', '')
    ) returning id into v_destination_id;
    insert into public.project_settings (
      project_id, default_uncertainty_years, initial_start_year,
      initial_end_year, initial_zoom_preset, timeline_density, minimum_time_unit
    ) values (
      v_destination_id,
      (p_payload #>> '{settings,defaultUncertaintyYears}')::integer,
      (p_payload #>> '{settings,initialStartYear}')::integer,
      (p_payload #>> '{settings,initialEndYear}')::integer,
      p_payload #>> '{settings,initialZoomPreset}',
      p_payload #>> '{settings,timelineDensity}',
      p_payload #>> '{settings,minimumTimeUnit}'
    );
  else
    v_destination_id := p_target_project_id;
    perform pg_advisory_xact_lock(hashtextextended(v_destination_id::text, 0));
    if p_mode = 'overwrite' then
      delete from public.timeline_events where project_id = v_destination_id;
      delete from public.timeline_items where project_id = v_destination_id;
      delete from public.timeline_item_types where project_id = v_destination_id;
      update public.projects set
        name = p_payload #>> '{project,name}',
        description = nullif(p_payload #>> '{project,description}', ''),
        visibility = coalesce(p_payload #>> '{project,visibility}', 'private'),
        public_id = case when p_payload #>> '{project,visibility}' = 'public'
          then case
            when nullif(p_payload #>> '{project,publicId}', '') is not null
              and not exists (
                select 1 from public.projects
                where public_id = p_payload #>> '{project,publicId}'
                  and id <> v_destination_id
              )
            then p_payload #>> '{project,publicId}'
            else replace(gen_random_uuid()::text, '-', '')
          end
          else null end,
        published_at = case when p_payload #>> '{project,visibility}' = 'public'
          then nullif(p_payload #>> '{project,publishedAt}', '')::timestamptz else null end
      where id = v_destination_id;
      update public.project_settings set
        default_uncertainty_years = (p_payload #>> '{settings,defaultUncertaintyYears}')::integer,
        initial_start_year = (p_payload #>> '{settings,initialStartYear}')::integer,
        initial_end_year = (p_payload #>> '{settings,initialEndYear}')::integer,
        initial_zoom_preset = p_payload #>> '{settings,initialZoomPreset}',
        timeline_density = p_payload #>> '{settings,timelineDensity}',
        minimum_time_unit = p_payload #>> '{settings,minimumTimeUnit}'
      where project_id = v_destination_id;
    end if;
  end if;

  if v_sections ? 'itemTypes' then
    for v_type in select value from jsonb_array_elements(coalesce(p_payload -> 'itemTypes', '[]'::jsonb)) loop
      v_source_id := (v_type ->> 'id')::uuid;
      v_mapped_id := null;
      if p_mode = 'append' then
        select id into v_mapped_id from public.timeline_item_types
        where project_id = v_destination_id and (
          id = v_source_id or normalized_name = lower(regexp_replace(btrim(v_type ->> 'name'), '\s+', ' ', 'g'))
        ) order by (id = v_source_id) desc limit 1;
      end if;
      if v_mapped_id is null then
        v_mapped_id := gen_random_uuid();
        insert into public.timeline_item_types (
          id, project_id, name, default_color, icon, sort_order, is_visible, is_system_seed
        ) values (
          v_mapped_id, v_destination_id, v_type ->> 'name', v_type ->> 'defaultColor',
          nullif(v_type ->> 'icon', ''), (v_type ->> 'sortOrder')::integer,
          coalesce((v_type ->> 'isVisible')::boolean, true), false
        );
      else
        update public.timeline_item_types set
          name = v_type ->> 'name', default_color = v_type ->> 'defaultColor',
          icon = nullif(v_type ->> 'icon', ''), sort_order = (v_type ->> 'sortOrder')::integer,
          is_visible = coalesce((v_type ->> 'isVisible')::boolean, true)
        where id = v_mapped_id and project_id = v_destination_id;
      end if;
      v_type_map := v_type_map || jsonb_build_object(v_source_id::text, v_mapped_id::text);
    end loop;
  end if;

  if v_sections ? 'timelineItems' then
    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'timelineItems', '[]'::jsonb)) loop
      v_source_id := (v_item ->> 'id')::uuid;
      v_mapped_id := nullif(v_type_map ->> (v_item ->> 'typeId'), '')::uuid;
      if v_mapped_id is null and exists (
        select 1 from public.timeline_item_types where id = (v_item ->> 'typeId')::uuid and project_id = v_destination_id
      ) then v_mapped_id := (v_item ->> 'typeId')::uuid; end if;
      if v_mapped_id is null then raise foreign_key_violation using message = 'Unknown item type'; end if;
      v_type_id := v_mapped_id;

      if p_mode = 'append' and exists (
        select 1 from public.timeline_items where id = v_source_id and project_id = v_destination_id
      ) then
        update public.timeline_items set
          type_id = v_type_id, title = v_item ->> 'title', description = nullif(v_item ->> 'description', ''),
          source_text = nullif(v_item ->> 'sourceText', ''), external_url = nullif(v_item ->> 'externalUrl', ''),
          temporal_type = v_item ->> 'temporalType', color_override = nullif(v_item ->> 'colorOverride', ''),
          manual_order = (v_item ->> 'manualOrder')::integer, is_visible = coalesce((v_item ->> 'isVisible')::boolean, true),
          start_year = case when v_item ->> 'temporalType' = 'point' then nullif(v_item #>> '{point,year}', '') else nullif(v_item #>> '{start,year}', '') end::integer,
          start_month = case when v_item ->> 'temporalType' = 'point' then nullif(v_item #>> '{point,month}', '') else nullif(v_item #>> '{start,month}', '') end::integer,
          start_day = case when v_item ->> 'temporalType' = 'point' then nullif(v_item #>> '{point,day}', '') else nullif(v_item #>> '{start,day}', '') end::integer,
          is_start_approximate = coalesce((v_item ->> 'isStartApproximate')::boolean, false),
          start_uncertainty_years = nullif(v_item ->> 'startUncertaintyYears', '')::integer,
          end_date_status = nullif(v_item ->> 'endDateStatus', ''),
          end_year = case when v_item ->> 'endDateStatus' = 'unknown' then nullif(v_item #>> '{lastConfirmed,year}', '') else nullif(v_item #>> '{end,year}', '') end::integer,
          end_month = case when v_item ->> 'endDateStatus' = 'unknown' then nullif(v_item #>> '{lastConfirmed,month}', '') else nullif(v_item #>> '{end,month}', '') end::integer,
          end_day = case when v_item ->> 'endDateStatus' = 'unknown' then nullif(v_item #>> '{lastConfirmed,day}', '') else nullif(v_item #>> '{end,day}', '') end::integer,
          is_end_approximate = coalesce((v_item ->> 'isEndApproximate')::boolean, false),
          end_uncertainty_years = nullif(v_item ->> 'endUncertaintyYears', '')::integer,
          is_point_approximate = coalesce((v_item ->> 'isPointApproximate')::boolean, false)
        where id = v_source_id and project_id = v_destination_id;
        v_mapped_id := v_source_id;
      else
        v_mapped_id := gen_random_uuid();
        insert into public.timeline_items (
          id, project_id, type_id, title, description, source_text, external_url,
          temporal_type, color_override, manual_order, is_visible, start_year, start_month,
          start_day, is_start_approximate, start_uncertainty_years, end_date_status,
          end_year, end_month, end_day, is_end_approximate, end_uncertainty_years, is_point_approximate
        ) values (
          v_mapped_id, v_destination_id, v_type_id, v_item ->> 'title',
          nullif(v_item ->> 'description', ''), nullif(v_item ->> 'sourceText', ''),
          nullif(v_item ->> 'externalUrl', ''), v_item ->> 'temporalType',
          nullif(v_item ->> 'colorOverride', ''), (v_item ->> 'manualOrder')::integer,
          coalesce((v_item ->> 'isVisible')::boolean, true),
          case when v_item ->> 'temporalType' = 'point' then nullif(v_item #>> '{point,year}', '') else nullif(v_item #>> '{start,year}', '') end::integer,
          case when v_item ->> 'temporalType' = 'point' then nullif(v_item #>> '{point,month}', '') else nullif(v_item #>> '{start,month}', '') end::integer,
          case when v_item ->> 'temporalType' = 'point' then nullif(v_item #>> '{point,day}', '') else nullif(v_item #>> '{start,day}', '') end::integer,
          coalesce((v_item ->> 'isStartApproximate')::boolean, false),
          nullif(v_item ->> 'startUncertaintyYears', '')::integer,
          nullif(v_item ->> 'endDateStatus', ''),
          case when v_item ->> 'endDateStatus' = 'unknown' then nullif(v_item #>> '{lastConfirmed,year}', '') else nullif(v_item #>> '{end,year}', '') end::integer,
          case when v_item ->> 'endDateStatus' = 'unknown' then nullif(v_item #>> '{lastConfirmed,month}', '') else nullif(v_item #>> '{end,month}', '') end::integer,
          case when v_item ->> 'endDateStatus' = 'unknown' then nullif(v_item #>> '{lastConfirmed,day}', '') else nullif(v_item #>> '{end,day}', '') end::integer,
          coalesce((v_item ->> 'isEndApproximate')::boolean, false),
          nullif(v_item ->> 'endUncertaintyYears', '')::integer,
          coalesce((v_item ->> 'isPointApproximate')::boolean, false)
        );
      end if;
      v_item_map := v_item_map || jsonb_build_object(v_source_id::text, v_mapped_id::text);
    end loop;
  end if;

  if v_sections ? 'timelineEvents' then
    for v_event in select value from jsonb_array_elements(coalesce(p_payload -> 'timelineEvents', '[]'::jsonb)) loop
      v_source_id := (v_event ->> 'id')::uuid;
      v_parent_id := nullif(v_item_map ->> (v_event ->> 'timelineItemId'), '')::uuid;
      if v_parent_id is null and exists (
        select 1 from public.timeline_items where id = (v_event ->> 'timelineItemId')::uuid and project_id = v_destination_id
      ) then v_parent_id := (v_event ->> 'timelineItemId')::uuid; end if;
      if v_parent_id is null then raise foreign_key_violation using message = 'Unknown event parent'; end if;
      if p_mode = 'append' and exists (
        select 1 from public.timeline_events where id = v_source_id and project_id = v_destination_id
      ) then
        update public.timeline_events set
          timeline_item_id = v_parent_id, title = v_event ->> 'title',
          event_year = (v_event #>> '{date,year}')::integer,
          event_month = nullif(v_event #>> '{date,month}', '')::integer,
          event_day = nullif(v_event #>> '{date,day}', '')::integer,
          is_approximate = coalesce((v_event ->> 'isApproximate')::boolean, false),
          description = nullif(v_event ->> 'description', ''), source_text = nullif(v_event ->> 'sourceText', ''),
          external_url = nullif(v_event ->> 'externalUrl', '')
        where id = v_source_id and project_id = v_destination_id;
      else
        v_mapped_id := gen_random_uuid();
        insert into public.timeline_events (
          id, project_id, timeline_item_id, title, event_year, event_month, event_day,
          is_approximate, description, source_text, external_url
        ) values (
          v_mapped_id, v_destination_id, v_parent_id, v_event ->> 'title',
          (v_event #>> '{date,year}')::integer, nullif(v_event #>> '{date,month}', '')::integer,
          nullif(v_event #>> '{date,day}', '')::integer,
          coalesce((v_event ->> 'isApproximate')::boolean, false),
          nullif(v_event ->> 'description', ''), nullif(v_event ->> 'sourceText', ''),
          nullif(v_event ->> 'externalUrl', '')
        );
      end if;
    end loop;
  end if;

  return v_destination_id;
end;
$$;

comment on function public.import_project_data(uuid, text, jsonb) is
'Creates, replaces, or upserts project backup sections while normalizing point and unknown-end dates into start/end columns.';

revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb) to authenticated;
