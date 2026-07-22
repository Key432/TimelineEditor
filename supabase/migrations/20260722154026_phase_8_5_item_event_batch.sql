create function public.create_timeline_item_with_events(
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

  select coalesce(max(manual_order), -1) + 1
  into v_manual_order
  from public.timeline_items
  where project_id = p_project_id;

  insert into public.timeline_items (
    project_id,
    type_id,
    title,
    description,
    source_text,
    external_url,
    temporal_type,
    color_override,
    manual_order,
    is_visible,
    start_year,
    start_month,
    start_day,
    is_start_approximate,
    start_uncertainty_years,
    end_date_status,
    end_year,
    end_month,
    end_day,
    is_end_approximate,
    end_uncertainty_years,
    last_confirmed_year,
    last_confirmed_month,
    last_confirmed_day,
    point_year,
    point_month,
    point_day,
    is_point_approximate
  ) values (
    p_project_id,
    (p_item ->> 'type_id')::uuid,
    p_item ->> 'title',
    p_item ->> 'description',
    p_item ->> 'source_text',
    p_item ->> 'external_url',
    p_item ->> 'temporal_type',
    p_item ->> 'color_override',
    v_manual_order,
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
    (p_item ->> 'last_confirmed_year')::integer,
    (p_item ->> 'last_confirmed_month')::integer,
    (p_item ->> 'last_confirmed_day')::integer,
    (p_item ->> 'point_year')::integer,
    (p_item ->> 'point_month')::integer,
    (p_item ->> 'point_day')::integer,
    coalesce((p_item ->> 'is_point_approximate')::boolean, false)
  )
  returning id into v_item_id;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    v_event_title := coalesce(
      nullif(btrim(v_event ->> 'title'), ''),
      'タイトル未入力'
    );

    begin
      insert into public.timeline_events (
        project_id,
        timeline_item_id,
        title,
        event_year,
        event_month,
        event_day,
        is_approximate,
        description,
        source_text,
        external_url
      ) values (
        p_project_id,
        v_item_id,
        v_event ->> 'title',
        (v_event ->> 'event_year')::integer,
        (v_event ->> 'event_month')::integer,
        (v_event ->> 'event_day')::integer,
        coalesce((v_event ->> 'is_approximate')::boolean, false),
        v_event ->> 'description',
        v_event ->> 'source_text',
        v_event ->> 'external_url'
      )
      returning id into v_event_id;

      v_created_event_ids := array_append(v_created_event_ids, v_event_id);
    exception
      when others then
        v_failure_reason := case sqlstate
          when '23514' then '入力内容がデータベース制約を満たしていません。'
          when '23503' then '親タイムラインアイテムを確認できませんでした。'
          when '42501' then 'イベントアイテムを追加する権限がありません。'
          when '22P02' then '入力形式を確認してください。'
          when '22003' then '数値が許容範囲を超えています。'
          else 'イベントアイテムを追加できませんでした。'
        end;
        v_failed_events := v_failed_events || jsonb_build_array(
          jsonb_build_object(
            'title', v_event_title,
            'reason', v_failure_reason
          )
        );
    end;
  end loop;

  return query
  select v_item_id, v_created_event_ids, v_failed_events;
end;
$$;

comment on function public.create_timeline_item_with_events(uuid, jsonb, jsonb)
is 'Creates the parent item first, then isolates each child event insert so event failures do not roll back the parent or successful siblings.';

revoke all on function public.create_timeline_item_with_events(uuid, jsonb, jsonb)
from public;
grant execute on function public.create_timeline_item_with_events(uuid, jsonb, jsonb)
to authenticated, service_role;
