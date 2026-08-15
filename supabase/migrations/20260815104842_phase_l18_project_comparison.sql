create table public.comparison_saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  configuration jsonb not null check (
    jsonb_typeof(configuration) = 'object'
    and pg_column_size(configuration) <= 32768
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index comparison_saved_views_owner_updated_at_idx
on public.comparison_saved_views (owner_id, updated_at desc);

create trigger comparison_saved_views_set_updated_at
before update on public.comparison_saved_views
for each row execute function public.set_updated_at();

create function public.enforce_comparison_saved_view_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.comparison_saved_views
      where owner_id = new.owner_id) >= 50 then
    raise exception 'comparison saved view limit exceeded';
  end if;
  return new;
end;
$$;

create trigger comparison_saved_views_enforce_limit
before insert on public.comparison_saved_views
for each row execute function public.enforce_comparison_saved_view_limit();

alter table public.comparison_saved_views enable row level security;

create policy "Owners can select comparison saved views"
on public.comparison_saved_views for select to authenticated
using (owner_id = (select auth.uid()));

create policy "Owners can insert comparison saved views"
on public.comparison_saved_views for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners can update comparison saved views"
on public.comparison_saved_views for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners can delete comparison saved views"
on public.comparison_saved_views for delete to authenticated
using (owner_id = (select auth.uid()));

revoke all on table public.comparison_saved_views from anon;
grant select, insert, update, delete on table public.comparison_saved_views to authenticated;
grant all on table public.comparison_saved_views to service_role;

revoke all on function public.enforce_comparison_saved_view_limit() from public, anon;
grant execute on function public.enforce_comparison_saved_view_limit() to authenticated;
