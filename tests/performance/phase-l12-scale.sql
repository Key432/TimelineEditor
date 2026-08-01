do $$
declare
  v_owner uuid;
  v_project constant uuid := '11111111-1111-4111-8111-111111111113';
  v_before bigint;
  v_after bigint;
  v_started timestamptz := clock_timestamp();
begin
  select id into v_owner from auth.users limit 1;
  select coalesce(sum(pg_total_relation_size(format('public.%I', relname)::regclass)), 0)
    into v_before
    from pg_stat_user_tables
    where relname in ('timeline_background_layers', 'timeline_background_periods');

  insert into public.projects(id, owner_id, name)
    values (v_project, v_owner, 'L12 capacity probe');
  insert into public.timeline_background_layers(project_id, name, sort_order)
  select v_project, 'Layer ' || layer_number, layer_number - 1
    from generate_series(1, 20) layer_number;
  insert into public.timeline_background_periods(
    project_id, layer_id, title, color,
    start_year, start_era, start_precision, start_calendar, is_start_approximate,
    end_year, end_era, end_precision, end_calendar, is_end_approximate
  )
  select v_project, layer.id, 'Period ' || period_number, '#7C9A92',
    period_number, 'ce', 'year', 'proleptic_gregorian', period_number % 5 = 0,
    period_number + 9, 'ce', 'year', 'proleptic_gregorian', period_number % 7 = 0
  from public.timeline_background_layers layer
  cross join generate_series(1, 100) period_number
  where layer.project_id = v_project;

  select coalesce(sum(pg_total_relation_size(format('public.%I', relname)::regclass)), 0)
    into v_after
    from pg_stat_user_tables
    where relname in ('timeline_background_layers', 'timeline_background_periods');
  raise exception 'L12_SCALE layers=20 periods=2000 elapsed_ms=% storage_delta_bytes=%',
    round(extract(epoch from (clock_timestamp() - v_started)) * 1000), v_after - v_before;
end
$$;
