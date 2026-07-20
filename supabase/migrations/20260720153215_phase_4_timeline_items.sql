alter table public.timeline_item_types
add constraint timeline_item_types_project_id_id_key unique (project_id, id);

create function public.is_valid_historical_date(
  p_year integer,
  p_month integer,
  p_day integer
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    p_year is null
    or (
      p_year >= 1
      and (
        (p_month is null and p_day is null)
        or (
          p_month between 1 and 12
          and (
            p_day is null
            or p_day between 1 and case
              when p_month = 2 then
                case
                  when p_year % 4 = 0
                    and (p_year % 100 <> 0 or p_year % 400 = 0)
                  then 29
                  else 28
                end
              when p_month in (4, 6, 9, 11) then 30
              else 31
            end
          )
        )
      )
    );
$$;

revoke all on function public.is_valid_historical_date(integer, integer, integer)
from public;
grant execute on function public.is_valid_historical_date(integer, integer, integer)
to authenticated, service_role;

create table public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text check (summary is null or length(summary) <= 2000),
  description text check (description is null or length(description) <= 20000),
  source_text text check (source_text is null or length(source_text) <= 10000),
  external_url text check (external_url is null or length(external_url) <= 2048),
  temporal_type text not null check (temporal_type in ('range', 'point')),
  color_override text check (
    color_override is null or color_override ~ '^#[0-9A-Fa-f]{6}$'
  ),
  manual_order integer not null check (manual_order >= 0),
  is_visible boolean not null default true,

  start_year integer check (start_year is null or start_year >= 1),
  start_month integer check (start_month is null or start_month between 1 and 12),
  start_day integer check (start_day is null or start_day between 1 and 31),
  is_start_approximate boolean not null default false,
  start_uncertainty_years integer check (
    start_uncertainty_years is null or start_uncertainty_years >= 0
  ),

  end_date_status text check (
    end_date_status is null or end_date_status in ('specified', 'ongoing', 'unknown')
  ),
  end_year integer check (end_year is null or end_year >= 1),
  end_month integer check (end_month is null or end_month between 1 and 12),
  end_day integer check (end_day is null or end_day between 1 and 31),
  is_end_approximate boolean not null default false,
  end_uncertainty_years integer check (
    end_uncertainty_years is null or end_uncertainty_years >= 0
  ),

  last_confirmed_year integer check (
    last_confirmed_year is null or last_confirmed_year >= 1
  ),
  last_confirmed_month integer check (
    last_confirmed_month is null or last_confirmed_month between 1 and 12
  ),
  last_confirmed_day integer check (
    last_confirmed_day is null or last_confirmed_day between 1 and 31
  ),

  point_year integer check (point_year is null or point_year >= 1),
  point_month integer check (point_month is null or point_month between 1 and 12),
  point_day integer check (point_day is null or point_day between 1 and 31),
  is_point_approximate boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint timeline_items_type_project_fk
    foreign key (project_id, type_id)
    references public.timeline_item_types (project_id, id),
  constraint timeline_items_start_precision_check check (
    (start_day is null or start_month is not null)
    and (start_month is null or start_year is not null)
  ),
  constraint timeline_items_end_precision_check check (
    (end_day is null or end_month is not null)
    and (end_month is null or end_year is not null)
  ),
  constraint timeline_items_last_confirmed_precision_check check (
    (last_confirmed_day is null or last_confirmed_month is not null)
    and (last_confirmed_month is null or last_confirmed_year is not null)
  ),
  constraint timeline_items_point_precision_check check (
    (point_day is null or point_month is not null)
    and (point_month is null or point_year is not null)
  ),
  constraint timeline_items_valid_dates_check check (
    public.is_valid_historical_date(start_year, start_month, start_day)
    and public.is_valid_historical_date(end_year, end_month, end_day)
    and public.is_valid_historical_date(
      last_confirmed_year,
      last_confirmed_month,
      last_confirmed_day
    )
    and public.is_valid_historical_date(point_year, point_month, point_day)
  ),
  constraint timeline_items_end_after_start_check check (
    end_year is null
    or (
      end_year * 372 + coalesce(end_month, 12) * 31 + coalesce(end_day, 31)
      >=
      start_year * 372 + coalesce(start_month, 1) * 31 + coalesce(start_day, 1)
    )
  ),
  constraint timeline_items_last_confirmed_after_start_check check (
    last_confirmed_year is null
    or (
      last_confirmed_year * 372
        + coalesce(last_confirmed_month, 12) * 31
        + coalesce(last_confirmed_day, 31)
      >=
      start_year * 372 + coalesce(start_month, 1) * 31 + coalesce(start_day, 1)
    )
  ),
  constraint timeline_items_temporal_shape_check check (
    (
      temporal_type = 'range'
      and start_year is not null
      and end_date_status is not null
      and point_year is null
      and point_month is null
      and point_day is null
      and is_point_approximate = false
    )
    or
    (
      temporal_type = 'point'
      and point_year is not null
      and start_year is null
      and start_month is null
      and start_day is null
      and is_start_approximate = false
      and start_uncertainty_years is null
      and end_date_status is null
      and end_year is null
      and end_month is null
      and end_day is null
      and is_end_approximate = false
      and end_uncertainty_years is null
      and last_confirmed_year is null
      and last_confirmed_month is null
      and last_confirmed_day is null
    )
  ),
  constraint timeline_items_end_status_shape_check check (
    temporal_type = 'point'
    or (
      end_date_status = 'specified'
      and end_year is not null
      and last_confirmed_year is null
      and last_confirmed_month is null
      and last_confirmed_day is null
    )
    or (
      end_date_status = 'ongoing'
      and end_year is null
      and end_month is null
      and end_day is null
      and is_end_approximate = false
      and end_uncertainty_years is null
      and last_confirmed_year is null
      and last_confirmed_month is null
      and last_confirmed_day is null
    )
    or (
      end_date_status = 'unknown'
      and end_year is null
      and end_month is null
      and end_day is null
      and is_end_approximate = false
      and end_uncertainty_years is null
    )
  )
);

comment on table public.timeline_items is
'Owner-managed range and point entries. Child events are introduced in Phase 6.';

create index timeline_items_project_manual_order_idx
on public.timeline_items (project_id, manual_order, id);

create index timeline_items_project_type_idx
on public.timeline_items (project_id, type_id);

create trigger timeline_items_set_updated_at
before update on public.timeline_items
for each row execute function public.set_updated_at();

alter table public.timeline_items enable row level security;

create policy "Owners can select timeline items"
on public.timeline_items for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_items.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can insert timeline items"
on public.timeline_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_items.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can update timeline items"
on public.timeline_items for update
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_items.project_id
      and projects.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_items.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete timeline items"
on public.timeline_items for delete
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_items.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.timeline_items from anon;
grant select, insert, update, delete on table public.timeline_items to authenticated;
grant all on table public.timeline_items to service_role;

create function public.move_timeline_item(
  p_project_id uuid,
  p_item_id uuid,
  p_new_position integer,
  p_new_type_id uuid default null
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
  from public.timeline_items
  where project_id = p_project_id;

  if p_new_position < 0 or p_new_position >= item_count then
    raise check_violation using message = 'Invalid timeline item position';
  end if;

  if not exists (
    select 1
    from public.timeline_items
    where id = p_item_id and project_id = p_project_id
  ) then
    raise no_data_found using message = 'Timeline item not found';
  end if;

  if p_new_type_id is not null and not exists (
    select 1
    from public.timeline_item_types
    where id = p_new_type_id and project_id = p_project_id
  ) then
    raise foreign_key_violation using message = 'Timeline item type not found';
  end if;

  with remaining as (
    select
      id,
      row_number() over (order by manual_order, id) - 1 as position
    from public.timeline_items
    where project_id = p_project_id and id <> p_item_id
  ),
  final_order as (
    select id, ordinal - 1 as position
    from unnest(
      array_cat(
        (select coalesce(array_agg(id order by position), array[]::uuid[])
         from remaining where position < p_new_position),
        array_cat(
          array[p_item_id],
          (select coalesce(array_agg(id order by position), array[]::uuid[])
           from remaining where position >= p_new_position)
        )
      )
    ) with ordinality as ordered_ids(id, ordinal)
  )
  update public.timeline_items as item
  set
    manual_order = final_order.position,
    type_id = case
      when item.id = p_item_id and p_new_type_id is not null then p_new_type_id
      else item.type_id
    end
  from final_order
  where item.id = final_order.id;
end;
$$;

revoke all on function public.move_timeline_item(uuid, uuid, integer, uuid) from public;
grant execute on function public.move_timeline_item(uuid, uuid, integer, uuid)
to authenticated;
