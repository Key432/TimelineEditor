do $$
declare
  v_owner uuid;
  v_project constant uuid := '11111111-1111-4111-8111-111111111112';
  v_type constant uuid := '22222222-2222-4222-8222-222222222222';
  v_items uuid[];
  v_before bigint;
  v_after bigint;
  v_started timestamptz := clock_timestamp();
begin
  select id into v_owner from auth.users limit 1;
  select coalesce(sum(pg_total_relation_size(format('public.%I', relname)::regclass)), 0)
    into v_before
    from pg_stat_user_tables
    where relname in ('timeline_items', 'timeline_events', 'timeline_event_item_links', 'entity_history');

  insert into public.projects(id, owner_id, name)
    values (v_project, v_owner, 'L11 capacity probe');
  insert into public.timeline_item_types(id, project_id, name, default_color, sort_order)
    values (v_type, v_project, 'Probe', '#00B0B0', 0);
  insert into public.timeline_items(
    project_id, type_id, title, temporal_type, manual_order, is_visible,
    start_year, start_era, start_precision, start_calendar,
    end_date_status, is_start_approximate, is_end_approximate, is_point_approximate
  )
  select v_project, v_type, 'Item ' || g, 'range', g - 1, true,
    1000 + (g % 1000), 'ce', 'year', 'proleptic_gregorian',
    'ongoing', false, false, false
  from generate_series(1, 1000) g;

  select array_agg(id order by manual_order) into v_items
    from public.timeline_items where project_id = v_project;
  insert into public.timeline_events(
    project_id, timeline_item_id, title, event_year, event_era,
    event_precision, event_calendar, is_approximate
  )
  select v_project, v_items[((g - 1) % 1000) + 1], 'Event ' || g,
    1000 + (g % 1000), 'ce', 'year', 'proleptic_gregorian', false
  from generate_series(1, 10000) g;

  select coalesce(sum(pg_total_relation_size(format('public.%I', relname)::regclass)), 0)
    into v_after
    from pg_stat_user_tables
    where relname in ('timeline_items', 'timeline_events', 'timeline_event_item_links', 'entity_history');
  -- The intentional exception reports the measurement and rolls back every
  -- probe row, so this script never leaves capacity-test data behind.
  raise exception 'L11_SCALE items=1000 events=10000 elapsed_ms=% storage_delta_bytes=%',
    round(extract(epoch from (clock_timestamp() - v_started)) * 1000), v_after - v_before;
end
$$;
