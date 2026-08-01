do $$
declare
  v_owner uuid;
  v_project constant uuid := '11111111-1111-4111-8111-111111111114';
  v_type uuid := gen_random_uuid();
  v_before bigint;
  v_after bigint;
  v_started timestamptz := clock_timestamp();
begin
  select id into v_owner from auth.users limit 1;
  select pg_total_relation_size('public.entity_relationships'::regclass)
    into v_before;

  insert into public.projects(id, owner_id, name)
    values (v_project, v_owner, 'L14 capacity probe');
  insert into public.timeline_item_types(
    id, project_id, name, default_color, icon, sort_order
  ) values (v_type, v_project, '人物', '#00B0B0', 'user', 0);
  insert into public.timeline_items(
    project_id, type_id, title, temporal_type, manual_order,
    start_year, start_era, start_precision, start_calendar
  )
  select v_project, v_type, 'Entity ' || entity_number, 'point', entity_number,
    1800 + entity_number, 'ce', 'year', 'proleptic_gregorian'
  from generate_series(1, 101) entity_number;

  insert into public.entity_relationships(
    project_id, source_type, source_id, target_type, target_id,
    relation_type, direction, line_style, source_marker, target_marker
  )
  select v_project, 'timeline_item', source.id, 'timeline_item', target.id,
    case (row_number() over ()) % 7
      when 0 then '影響' when 1 then '参照' when 2 then '協働'
      when 3 then '師弟' when 4 then '対立' when 5 then '継承' else 'その他'
    end,
    'directed',
    case when (row_number() over ()) % 2 = 0 then 'single' else 'double' end,
    'none', 'arrow'
  from public.timeline_items source
  cross join public.timeline_items target
  where source.project_id = v_project
    and target.project_id = v_project
    and source.id <> target.id
  limit 10000;

  select pg_total_relation_size('public.entity_relationships'::regclass)
    into v_after;
  raise exception 'L14_SCALE relationships=10000 elapsed_ms=% storage_delta_bytes=%',
    round(extract(epoch from (clock_timestamp() - v_started)) * 1000),
    v_after - v_before;
end
$$;
