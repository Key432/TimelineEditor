do $$
declare
  v_owner uuid;
  v_before bigint;
  v_after bigint;
  v_started timestamptz := clock_timestamp();
begin
  insert into auth.users(id) values (gen_random_uuid()) returning id into v_owner;
  select pg_total_relation_size('public.comparison_saved_views'::regclass)
    into v_before;

  insert into public.comparison_saved_views(owner_id, name, configuration)
  select v_owner, 'Comparison ' || view_number,
    jsonb_build_object(
      'version', 1,
      'projectIds', jsonb_build_array(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()),
      'hiddenProjectIds', '[]'::jsonb,
      'visibleStartOrdinal', -1000000,
      'visibleEndOrdinal', 1000000,
      'zoomLevel', view_number % 5,
      'highlightStartOrdinal', null,
      'highlightEndOrdinal', null,
      'filters', jsonb_build_object('tagNames', '[]'::jsonb, 'typeNames', '[]'::jsonb, 'eventTypeNames', '[]'::jsonb)
    )
  from generate_series(1, 50) view_number;

  select pg_total_relation_size('public.comparison_saved_views'::regclass)
    into v_after;
  raise exception 'L18_SCALE views=50 duplicated_rows=0 elapsed_ms=% storage_delta_bytes=%',
    round(extract(epoch from (clock_timestamp() - v_started)) * 1000),
    v_after - v_before;
end
$$;
