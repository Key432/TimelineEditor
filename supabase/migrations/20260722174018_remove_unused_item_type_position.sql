create or replace function public.move_timeline_item_type(
  p_project_id uuid,
  p_type_id uuid,
  p_new_position integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));

  select count(*) into item_count
  from public.timeline_item_types
  where project_id = p_project_id;

  if p_new_position < 0 or p_new_position >= item_count then
    raise check_violation using message = 'Invalid item type position';
  end if;

  perform 1
  from public.timeline_item_types
  where id = p_type_id and project_id = p_project_id;

  if not found then
    raise no_data_found using message = 'Timeline item type not found';
  end if;

  with remaining as (
    select
      id,
      row_number() over (order by sort_order, id) - 1 as position
    from public.timeline_item_types
    where project_id = p_project_id and id <> p_type_id
  ),
  final_order as (
    select id, ordinal - 1 as position
    from unnest(
      array_cat(
        (select coalesce(array_agg(id order by position), array[]::uuid[])
         from remaining where position < p_new_position),
        array_cat(
          array[p_type_id],
          (select coalesce(array_agg(id order by position), array[]::uuid[])
           from remaining where position >= p_new_position)
        )
      )
    ) with ordinality as ordered_ids(id, ordinal)
  )
  update public.timeline_item_types as item_type
  set sort_order = final_order.position
  from final_order
  where item_type.id = final_order.id;
end;
$$;

revoke all on function public.move_timeline_item_type(uuid, uuid, integer) from public;
grant execute on function public.move_timeline_item_type(uuid, uuid, integer) to authenticated;
