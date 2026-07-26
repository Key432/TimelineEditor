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
  v_owner_id uuid := (select auth.uid());
  type_row jsonb;
  item_row jsonb;
  event_row jsonb;
  v_source_id text;
  mapped_id uuid;
  parent_id uuid;
  type_map jsonb := '{}'::jsonb;
  item_map jsonb := '{}'::jsonb;
begin
  if v_owner_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_mode not in ('duplicate', 'overwrite', 'append') then
    raise check_violation using message = 'Unsupported import mode';
  end if;
  if not exists (
    select 1 from public.projects
    where id = p_target_project_id and projects.owner_id = v_owner_id
  ) then
    raise no_data_found using message = 'Project not found';
  end if;

  if p_mode = 'duplicate' then
    insert into public.projects (owner_id, name, description)
    values (
      v_owner_id,
      left(btrim(p_payload #>> '{project,name}') || ' (コピー)', 200),
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
    if p_mode = 'overwrite' then
      delete from public.timeline_events where project_id = v_destination_id;
      delete from public.timeline_items where project_id = v_destination_id;
      delete from public.timeline_item_types where project_id = v_destination_id;
      update public.projects set
        name = p_payload #>> '{project,name}',
        description = nullif(p_payload #>> '{project,description}', ''),
        visibility = coalesce(p_payload #>> '{project,visibility}', 'private'),
        public_id = case when p_payload #>> '{project,visibility}' = 'public'
          then nullif(p_payload #>> '{project,publicId}', '') else null end,
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

  for type_row in select value from jsonb_array_elements(p_payload->'itemTypes') loop
    v_source_id := type_row->>'id';
    select id into mapped_id from public.timeline_item_types
    where project_id = v_destination_id
      and normalized_name = lower(regexp_replace(btrim(type_row->>'name'), '\s+', ' ', 'g'));
    if mapped_id is null then
      insert into public.timeline_item_types (
        project_id, name, default_color, icon, sort_order, is_visible, is_system_seed
      ) values (
        v_destination_id, type_row->>'name', type_row->>'defaultColor',
        nullif(type_row->>'icon', ''), (type_row->>'sortOrder')::integer,
        coalesce((type_row->>'isVisible')::boolean, true), false
      ) returning id into mapped_id;
    end if;
    type_map := type_map || jsonb_build_object(v_source_id, mapped_id::text);
  end loop;

  for item_row in select value from jsonb_array_elements(p_payload->'timelineItems') loop
    mapped_id := nullif(type_map->>(item_row->>'typeId'), '')::uuid;
    if mapped_id is null then
      raise foreign_key_violation using message = 'Unknown item type';
    end if;
    insert into public.timeline_items (
      project_id, type_id, title, description, source_text, external_url,
      temporal_type, color_override, manual_order, is_visible,
      start_year, start_month, start_day, is_start_approximate, start_uncertainty_years,
      end_date_status, end_year, end_month, end_day, is_end_approximate,
      end_uncertainty_years, last_confirmed_year, last_confirmed_month,
      last_confirmed_day, point_year, point_month, point_day, is_point_approximate
    ) values (
      v_destination_id, mapped_id, item_row->>'title', nullif(item_row->>'description', ''),
      nullif(item_row->>'sourceText', ''), nullif(item_row->>'externalUrl', ''),
      item_row->>'temporalType', nullif(item_row->>'colorOverride', ''),
      (item_row->>'manualOrder')::integer, coalesce((item_row->>'isVisible')::boolean, true),
      nullif(item_row #>> '{start,year}', '')::integer,
      nullif(item_row #>> '{start,month}', '')::integer,
      nullif(item_row #>> '{start,day}', '')::integer,
      coalesce((item_row->>'isStartApproximate')::boolean, false),
      nullif(item_row->>'startUncertaintyYears', '')::integer,
      nullif(item_row->>'endDateStatus', ''),
      nullif(item_row #>> '{end,year}', '')::integer,
      nullif(item_row #>> '{end,month}', '')::integer,
      nullif(item_row #>> '{end,day}', '')::integer,
      coalesce((item_row->>'isEndApproximate')::boolean, false),
      nullif(item_row->>'endUncertaintyYears', '')::integer,
      nullif(item_row #>> '{lastConfirmed,year}', '')::integer,
      nullif(item_row #>> '{lastConfirmed,month}', '')::integer,
      nullif(item_row #>> '{lastConfirmed,day}', '')::integer,
      nullif(item_row #>> '{point,year}', '')::integer,
      nullif(item_row #>> '{point,month}', '')::integer,
      nullif(item_row #>> '{point,day}', '')::integer,
      coalesce((item_row->>'isPointApproximate')::boolean, false)
    ) returning id into mapped_id;
    item_map := item_map || jsonb_build_object(item_row->>'id', mapped_id::text);
  end loop;

  for event_row in select value from jsonb_array_elements(p_payload->'timelineEvents') loop
    parent_id := nullif(item_map->>(event_row->>'timelineItemId'), '')::uuid;
    if parent_id is null then
      raise foreign_key_violation using message = 'Unknown event parent';
    end if;
    insert into public.timeline_events (
      project_id, timeline_item_id, title, event_year, event_month, event_day,
      is_approximate, description, source_text, external_url
    ) values (
      v_destination_id, parent_id, event_row->>'title',
      (event_row #>> '{date,year}')::integer,
      nullif(event_row #>> '{date,month}', '')::integer,
      nullif(event_row #>> '{date,day}', '')::integer,
      coalesce((event_row->>'isApproximate')::boolean, false),
      nullif(event_row->>'description', ''), nullif(event_row->>'sourceText', ''),
      nullif(event_row->>'externalUrl', '')
    );
  end loop;

  return v_destination_id;
end;
$$;

revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb) to authenticated;
