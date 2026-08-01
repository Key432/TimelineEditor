create table public.table_view_preferences (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  visible_columns jsonb not null default '[]'::jsonb check (jsonb_typeof(visible_columns) = 'array'),
  column_widths jsonb not null default '{}'::jsonb check (jsonb_typeof(column_widths) = 'object'),
  wrapped_columns jsonb not null default '[]'::jsonb check (jsonb_typeof(wrapped_columns) = 'array'),
  frozen_column_count integer not null default 1 check (frozen_column_count between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, owner_id, entity_type)
);

create table public.csv_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  mapping jsonb not null check (jsonb_typeof(mapping) = 'object'),
  date_format text not null default 'separate' check (date_format in ('separate', 'iso', 'japanese')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, owner_id, name)
);

create table public.bulk_edit_operations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  label text not null check (char_length(label) between 1 and 200),
  inverse_patch jsonb not null check (jsonb_typeof(inverse_patch) = 'array'),
  affected_count integer not null check (affected_count between 1 and 1000),
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create index table_view_preferences_project_idx on public.table_view_preferences (project_id);
create index csv_mapping_profiles_project_idx on public.csv_mapping_profiles (project_id, updated_at desc);
create index bulk_edit_operations_project_created_idx on public.bulk_edit_operations (project_id, created_at desc);

create trigger set_table_view_preferences_updated_at
before update on public.table_view_preferences
for each row execute function public.set_updated_at();

create trigger set_csv_mapping_profiles_updated_at
before update on public.csv_mapping_profiles
for each row execute function public.set_updated_at();

create function public.enforce_csv_mapping_profile_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.csv_mapping_profiles
      where project_id = new.project_id and owner_id = new.owner_id) >= 50 then
    raise exception 'CSV mapping profile limit exceeded';
  end if;
  return new;
end;
$$;

create trigger enforce_csv_mapping_profile_limit
before insert on public.csv_mapping_profiles
for each row execute function public.enforce_csv_mapping_profile_limit();

create function public.trim_bulk_edit_operations()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.bulk_edit_operations
  where project_id = new.project_id
    and owner_id = new.owner_id
    and (
      created_at < now() - interval '10 days'
      or id in (
        select id from public.bulk_edit_operations
        where project_id = new.project_id and owner_id = new.owner_id
        order by created_at desc, id desc
        offset 100
      )
    );
  return new;
end;
$$;

create trigger trim_bulk_edit_operations
after insert on public.bulk_edit_operations
for each row execute function public.trim_bulk_edit_operations();

alter table public.table_view_preferences enable row level security;
alter table public.csv_mapping_profiles enable row level security;
alter table public.bulk_edit_operations enable row level security;

create policy "Owners can manage table view preferences"
on public.table_view_preferences for all to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.projects where projects.id = table_view_preferences.project_id
    and projects.owner_id = (select auth.uid())
))
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.projects where projects.id = table_view_preferences.project_id
    and projects.owner_id = (select auth.uid())
));

create policy "Owners can manage CSV mapping profiles"
on public.csv_mapping_profiles for all to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.projects where projects.id = csv_mapping_profiles.project_id
    and projects.owner_id = (select auth.uid())
))
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.projects where projects.id = csv_mapping_profiles.project_id
    and projects.owner_id = (select auth.uid())
));

create policy "Owners can manage bulk edit operations"
on public.bulk_edit_operations for all to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.projects where projects.id = bulk_edit_operations.project_id
    and projects.owner_id = (select auth.uid())
))
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.projects where projects.id = bulk_edit_operations.project_id
    and projects.owner_id = (select auth.uid())
));

revoke all on table public.table_view_preferences, public.csv_mapping_profiles, public.bulk_edit_operations from anon, authenticated;
grant select, insert, update, delete on table public.table_view_preferences, public.csv_mapping_profiles, public.bulk_edit_operations to authenticated;
grant all on table public.table_view_preferences, public.csv_mapping_profiles, public.bulk_edit_operations to service_role;

revoke all on function public.enforce_csv_mapping_profile_limit(), public.trim_bulk_edit_operations() from public;

comment on table public.table_view_preferences is 'Per-user Notion-style table layout preferences for Phase L11.';
comment on table public.csv_mapping_profiles is 'Reusable arbitrary CSV column mappings; source CSV files are never persisted.';
comment on table public.bulk_edit_operations is 'One compressed inverse patch per bulk operation, retained for operation-level undo.';
