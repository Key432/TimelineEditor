create table public.timeline_background_layers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  description text check (length(coalesce(description, '')) <= 2000),
  sort_order integer not null check (sort_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, name)
);

create index timeline_background_layers_project_order_idx
on public.timeline_background_layers (project_id, sort_order, id);

create table public.timeline_background_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  layer_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (length(coalesce(description, '')) <= 5000),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  start_era text not null,
  start_precision text not null,
  start_year integer not null,
  start_month integer,
  start_day integer,
  start_original_text text,
  start_calendar text not null default 'proleptic_gregorian',
  is_start_approximate boolean not null default false,
  end_era text not null,
  end_precision text not null,
  end_year integer not null,
  end_month integer,
  end_day integer,
  end_original_text text,
  end_calendar text not null default 'proleptic_gregorian',
  is_end_approximate boolean not null default false,
  start_normalized_min bigint generated always as
    (public.historical_date_sort_key(start_era, start_precision, start_year, start_month, start_day, 'start')) stored,
  end_normalized_max bigint generated always as
    (public.historical_date_sort_key(end_era, end_precision, end_year, end_month, end_day, 'end')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_background_periods_layer_fkey
    foreign key (project_id, layer_id)
    references public.timeline_background_layers (project_id, id)
    on delete cascade,
  constraint timeline_background_periods_dates_check check (
    public.is_valid_extended_historical_date(start_era, start_precision, start_year, start_month, start_day, start_calendar)
    and public.is_valid_extended_historical_date(end_era, end_precision, end_year, end_month, end_day, end_calendar)
    and length(coalesce(start_original_text, '')) <= 200
    and length(coalesce(end_original_text, '')) <= 200
    and end_normalized_max >= start_normalized_min
  )
);

create index timeline_background_periods_layer_range_idx
on public.timeline_background_periods
  (layer_id, start_normalized_min, end_normalized_max, id);
create index timeline_background_periods_project_id_idx
on public.timeline_background_periods (project_id);

create trigger timeline_background_layers_set_updated_at
before update on public.timeline_background_layers
for each row execute function public.set_updated_at();
create trigger timeline_background_periods_set_updated_at
before update on public.timeline_background_periods
for each row execute function public.set_updated_at();

alter table public.timeline_background_layers enable row level security;
alter table public.timeline_background_periods enable row level security;

create policy "Visible background layers follow project access"
on public.timeline_background_layers for select to anon, authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_background_layers.project_id
    and (
      projects.owner_id = (select auth.uid())
      or projects.visibility = 'public'
    )
));
create policy "Owners can insert background layers"
on public.timeline_background_layers for insert to authenticated
with check (exists (
  select 1 from public.projects
  where projects.id = timeline_background_layers.project_id
    and projects.owner_id = (select auth.uid())
));
create policy "Owners can update background layers"
on public.timeline_background_layers for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_background_layers.project_id
    and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects
  where projects.id = timeline_background_layers.project_id
    and projects.owner_id = (select auth.uid())
));
create policy "Owners can delete background layers"
on public.timeline_background_layers for delete to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_background_layers.project_id
    and projects.owner_id = (select auth.uid())
));

create policy "Visible background periods follow project access"
on public.timeline_background_periods for select to anon, authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_background_periods.project_id
    and (
      projects.owner_id = (select auth.uid())
      or projects.visibility = 'public'
    )
));
create policy "Owners can insert background periods"
on public.timeline_background_periods for insert to authenticated
with check (exists (
  select 1 from public.projects
  where projects.id = timeline_background_periods.project_id
    and projects.owner_id = (select auth.uid())
));
create policy "Owners can update background periods"
on public.timeline_background_periods for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_background_periods.project_id
    and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects
  where projects.id = timeline_background_periods.project_id
    and projects.owner_id = (select auth.uid())
));
create policy "Owners can delete background periods"
on public.timeline_background_periods for delete to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = timeline_background_periods.project_id
    and projects.owner_id = (select auth.uid())
));

revoke all on table public.timeline_background_layers from anon, authenticated;
revoke all on table public.timeline_background_periods from anon, authenticated;
grant select on table public.timeline_background_layers to anon;
grant select on table public.timeline_background_periods to anon;
grant select, insert, update, delete on table public.timeline_background_layers to authenticated;
grant select, insert, update, delete on table public.timeline_background_periods to authenticated;
grant all on table public.timeline_background_layers to service_role;
grant all on table public.timeline_background_periods to service_role;

alter function public.import_project_data(uuid, text, jsonb)
rename to import_project_data_v5;
revoke all on function public.import_project_data_v5(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.import_project_data_v5(uuid, text, jsonb)
to authenticated;

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
  destination_id uuid;
  layer_row jsonb;
  period_row jsonb;
  destination_layer_id uuid;
  imports_backgrounds boolean :=
    p_payload->'importSections' is null
    or p_payload->'importSections' ? 'backgroundLayers';
begin
  destination_id := public.import_project_data_v5(
    p_target_project_id,
    p_mode,
    p_payload
  );
  if not imports_backgrounds then
    return destination_id;
  end if;

  if p_mode = 'overwrite' then
    delete from public.timeline_background_layers
    where project_id = destination_id;
  end if;

  for layer_row in
    select value
    from jsonb_array_elements(coalesce(p_payload->'backgroundLayers', '[]'::jsonb))
  loop
    insert into public.timeline_background_layers (
      project_id, name, description, sort_order, is_visible
    ) values (
      destination_id,
      layer_row->>'name',
      nullif(layer_row->>'description', ''),
      (layer_row->>'sortOrder')::integer,
      coalesce((layer_row->>'isVisible')::boolean, true)
    ) returning id into destination_layer_id;

    for period_row in
      select value
      from jsonb_array_elements(coalesce(layer_row->'periods', '[]'::jsonb))
    loop
      insert into public.timeline_background_periods (
        project_id, layer_id, title, description, color,
        start_era, start_precision, start_year, start_month, start_day,
        start_original_text, start_calendar, is_start_approximate,
        end_era, end_precision, end_year, end_month, end_day,
        end_original_text, end_calendar, is_end_approximate
      ) values (
        destination_id, destination_layer_id,
        period_row->>'title', nullif(period_row->>'description', ''), period_row->>'color',
        period_row #>> '{start,era}', period_row #>> '{start,precision}',
        (period_row #>> '{start,year}')::integer,
        nullif(period_row #>> '{start,month}', '')::integer,
        nullif(period_row #>> '{start,day}', '')::integer,
        nullif(period_row #>> '{start,originalText}', ''),
        period_row #>> '{start,calendar}',
        coalesce((period_row->>'isStartApproximate')::boolean, false),
        period_row #>> '{end,era}', period_row #>> '{end,precision}',
        (period_row #>> '{end,year}')::integer,
        nullif(period_row #>> '{end,month}', '')::integer,
        nullif(period_row #>> '{end,day}', '')::integer,
        nullif(period_row #>> '{end,originalText}', ''),
        period_row #>> '{end,calendar}',
        coalesce((period_row->>'isEndApproximate')::boolean, false)
      );
    end loop;
  end loop;
  return destination_id;
end;
$$;

revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb)
to authenticated;

insert into private.application_schema_versions (version, name, baseline_migration)
values (6, 'background-layers', '20260801085852_phase_l12_background_layers.sql');
