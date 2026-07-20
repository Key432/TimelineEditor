create table public.timeline_item_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  normalized_name text generated always as (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  ) stored,
  default_color text not null check (default_color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text check (icon is null or length(btrim(icon)) between 1 and 50),
  sort_order integer not null check (sort_order >= 0),
  is_visible boolean not null default true,
  is_system_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_item_types_project_name_key
    unique (project_id, normalized_name)
);

comment on table public.timeline_item_types is
'Project-scoped item type master. Future timeline_items.type_id must use the default restrictive delete behavior, never ON DELETE CASCADE.';

create index timeline_item_types_project_sort_idx
on public.timeline_item_types (project_id, sort_order, id);

create trigger timeline_item_types_set_updated_at
before update on public.timeline_item_types
for each row execute function public.set_updated_at();

alter table public.timeline_item_types enable row level security;

create policy "Owners can select timeline item types"
on public.timeline_item_types for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_item_types.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can insert timeline item types"
on public.timeline_item_types for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_item_types.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can update timeline item types"
on public.timeline_item_types for update
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_item_types.project_id
      and projects.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_item_types.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete timeline item types"
on public.timeline_item_types for delete
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_item_types.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.timeline_item_types from anon;
grant select, insert, update, delete on table public.timeline_item_types to authenticated;
grant all on table public.timeline_item_types to service_role;

drop function public.create_project_with_settings(
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  text
);

create function public.create_project_with_settings(
  p_name text,
  p_description text,
  p_template text,
  p_default_uncertainty_years integer,
  p_initial_start_year integer,
  p_initial_end_year integer,
  p_initial_zoom_preset text,
  p_timeline_density text,
  p_minimum_time_unit text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  project_id uuid;
begin
  if p_template not in ('literature', 'art', 'philosophy', 'general', 'empty') then
    raise check_violation using message = 'Unknown project template';
  end if;

  insert into public.projects (owner_id, name, description)
  values ((select auth.uid()), p_name, p_description)
  returning id into project_id;

  insert into public.project_settings (
    project_id,
    default_uncertainty_years,
    initial_start_year,
    initial_end_year,
    initial_zoom_preset,
    timeline_density,
    minimum_time_unit
  )
  values (
    project_id,
    p_default_uncertainty_years,
    p_initial_start_year,
    p_initial_end_year,
    p_initial_zoom_preset,
    p_timeline_density,
    p_minimum_time_unit
  );

  insert into public.timeline_item_types (
    project_id,
    name,
    default_color,
    icon,
    sort_order,
    is_system_seed
  )
  select
    project_id,
    seed.name,
    seed.default_color,
    seed.icon,
    seed.sort_order,
    true
  from (
    values
      ('literature', '人物', '#2878B5', 'user-round', 0),
      ('literature', '文学運動', '#8B5CF6', 'sparkles', 1),
      ('literature', '雑誌', '#D97706', 'newspaper', 2),
      ('literature', '団体', '#27845A', 'users-round', 3),
      ('literature', '作品', '#C73D4D', 'book-open', 4),
      ('literature', '政治・社会的事件', '#6B7280', 'landmark', 5),
      ('literature', 'その他イベント', '#64748B', 'circle-dot', 6),
      ('art', '人物', '#2878B5', 'user-round', 0),
      ('art', '芸術運動', '#8B5CF6', 'palette', 1),
      ('art', '団体', '#27845A', 'users-round', 2),
      ('art', '作品', '#C73D4D', 'image', 3),
      ('art', '展覧会・公演', '#D97706', 'gallery-horizontal', 4),
      ('art', '政治・社会的事件', '#6B7280', 'landmark', 5),
      ('art', 'その他イベント', '#64748B', 'circle-dot', 6),
      ('philosophy', '人物', '#2878B5', 'user-round', 0),
      ('philosophy', '思想潮流', '#8B5CF6', 'brain', 1),
      ('philosophy', '団体', '#27845A', 'users-round', 2),
      ('philosophy', '作品', '#C73D4D', 'book-open', 3),
      ('philosophy', '政治・社会的事件', '#6B7280', 'landmark', 4),
      ('philosophy', 'その他イベント', '#64748B', 'circle-dot', 5),
      ('general', '人物', '#2878B5', 'user-round', 0),
      ('general', '思想潮流', '#8B5CF6', 'brain', 1),
      ('general', '文学運動／芸術運動', '#A855F7', 'sparkles', 2),
      ('general', '雑誌', '#D97706', 'newspaper', 3),
      ('general', '団体', '#27845A', 'users-round', 4),
      ('general', '作品', '#C73D4D', 'book-open', 5),
      ('general', '戦争', '#B45309', 'swords', 6),
      ('general', '政治・社会的事件', '#6B7280', 'landmark', 7),
      ('general', '展覧会・公演', '#DB2777', 'gallery-horizontal', 8),
      ('general', 'その他イベント', '#64748B', 'circle-dot', 9)
  ) as seed(template, name, default_color, icon, sort_order)
  where seed.template = p_template;

  return project_id;
end;
$$;

revoke all on function public.create_project_with_settings(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  text
) from public;
grant execute on function public.create_project_with_settings(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  text
) to authenticated;

create function public.move_timeline_item_type(
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
  current_position integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));

  select count(*) into item_count
  from public.timeline_item_types
  where project_id = p_project_id;

  if p_new_position < 0 or p_new_position >= item_count then
    raise check_violation using message = 'Invalid item type position';
  end if;

  select sort_order into current_position
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
