create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  public_id text unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_publication_state_check check (
    (visibility = 'private' and published_at is null)
    or visibility = 'public'
  )
);

create index projects_owner_id_idx on public.projects (owner_id);

create table public.project_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  default_uncertainty_years integer not null default 5 check (default_uncertainty_years between 0 and 1000),
  initial_start_year integer not null default 1800 check (initial_start_year >= 1),
  initial_end_year integer not null check (initial_end_year >= 1),
  initial_zoom_preset text not null default 'fit-range' check (
    initial_zoom_preset in ('fit-range', 'century', 'decade', 'year')
  ),
  timeline_density text not null default 'comfortable' check (
    timeline_density in ('comfortable', 'compact')
  ),
  minimum_time_unit text not null default 'day' check (
    minimum_time_unit in ('year', 'month', 'day')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_settings_initial_range_check check (
    initial_end_year >= initial_start_year
  )
);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger project_settings_set_updated_at
before update on public.project_settings
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.project_settings enable row level security;

create policy "Owners can select projects"
on public.projects for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can insert projects"
on public.projects for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update projects"
on public.projects for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete projects"
on public.projects for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can select project settings"
on public.project_settings for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_settings.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can insert project settings"
on public.project_settings for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects
    where projects.id = project_settings.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can update project settings"
on public.project_settings for update
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_settings.project_id
      and projects.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = project_settings.project_id
      and projects.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete project settings"
on public.project_settings for delete
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_settings.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.projects from anon;
revoke all on table public.project_settings from anon;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.project_settings to authenticated;
grant all on table public.projects to service_role;
grant all on table public.project_settings to service_role;

create function public.create_project_with_settings(
  p_name text,
  p_description text,
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

  return project_id;
end;
$$;

create function public.update_project_with_settings(
  p_project_id uuid,
  p_name text,
  p_description text,
  p_default_uncertainty_years integer,
  p_initial_start_year integer,
  p_initial_end_year integer,
  p_initial_zoom_preset text,
  p_timeline_density text,
  p_minimum_time_unit text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.projects
  set name = p_name,
      description = p_description
  where id = p_project_id;

  if not found then
    raise no_data_found using message = 'Project not found';
  end if;

  update public.project_settings
  set default_uncertainty_years = p_default_uncertainty_years,
      initial_start_year = p_initial_start_year,
      initial_end_year = p_initial_end_year,
      initial_zoom_preset = p_initial_zoom_preset,
      timeline_density = p_timeline_density,
      minimum_time_unit = p_minimum_time_unit
  where project_id = p_project_id;

  if not found then
    raise no_data_found using message = 'Project settings not found';
  end if;
end;
$$;

revoke all on function public.create_project_with_settings(text, text, integer, integer, integer, text, text, text) from public;
revoke all on function public.update_project_with_settings(uuid, text, text, integer, integer, integer, text, text, text) from public;
grant execute on function public.create_project_with_settings(text, text, integer, integer, integer, text, text, text) to authenticated;
grant execute on function public.update_project_with_settings(uuid, text, text, integer, integer, integer, text, text, text) to authenticated;
