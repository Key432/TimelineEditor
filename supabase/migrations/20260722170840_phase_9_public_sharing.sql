alter table public.projects
drop constraint projects_publication_state_check;

alter table public.projects
add constraint projects_publication_state_check check (
  (visibility = 'private' and published_at is null)
  or (
    visibility = 'public'
    and public_id is not null
    and published_at is not null
  )
);

drop policy "Owners can select projects" on public.projects;
create policy "Authenticated users can select permitted projects"
on public.projects for select
to authenticated
using (owner_id = (select auth.uid()) or visibility = 'public');

create policy "Anonymous users can select public projects"
on public.projects for select
to anon
using (visibility = 'public');

drop policy "Owners can select project settings" on public.project_settings;
create policy "Authenticated users can select permitted project settings"
on public.project_settings for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_settings.project_id
      and (
        projects.owner_id = (select auth.uid())
        or projects.visibility = 'public'
      )
  )
);

create policy "Anonymous users can select public project settings"
on public.project_settings for select
to anon
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_settings.project_id
      and projects.visibility = 'public'
  )
);

drop policy "Owners can select timeline item types" on public.timeline_item_types;
create policy "Authenticated users can select permitted timeline item types"
on public.timeline_item_types for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_item_types.project_id
      and (
        projects.owner_id = (select auth.uid())
        or projects.visibility = 'public'
      )
  )
);

create policy "Anonymous users can select public timeline item types"
on public.timeline_item_types for select
to anon
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_item_types.project_id
      and projects.visibility = 'public'
  )
);

drop policy "Owners can select timeline items" on public.timeline_items;
create policy "Authenticated users can select permitted timeline items"
on public.timeline_items for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_items.project_id
      and (
        projects.owner_id = (select auth.uid())
        or projects.visibility = 'public'
      )
  )
);

create policy "Anonymous users can select public timeline items"
on public.timeline_items for select
to anon
using (
  exists (
    select 1
    from public.projects
    where projects.id = timeline_items.project_id
      and projects.visibility = 'public'
  )
);

grant select on table public.projects to anon;
grant select on table public.project_settings to anon;
grant select on table public.timeline_item_types to anon;
grant select on table public.timeline_items to anon;

create function public.publish_project(p_project_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_public_id text;
begin
  update public.projects
  set visibility = 'public',
      public_id = coalesce(public_id, replace(gen_random_uuid()::text, '-', '')),
      published_at = now()
  where id = p_project_id
    and owner_id = (select auth.uid())
  returning public_id into result_public_id;

  if not found then
    raise no_data_found using message = 'Project not found';
  end if;

  return result_public_id;
end;
$$;

create function public.unpublish_project(p_project_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.projects
  set visibility = 'private',
      published_at = null
  where id = p_project_id
    and owner_id = (select auth.uid());

  if not found then
    raise no_data_found using message = 'Project not found';
  end if;
end;
$$;

create function public.regenerate_project_public_id(p_project_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_public_id text;
begin
  update public.projects
  set public_id = replace(gen_random_uuid()::text, '-', '')
  where id = p_project_id
    and owner_id = (select auth.uid())
  returning public_id into result_public_id;

  if not found then
    raise no_data_found using message = 'Project not found';
  end if;

  return result_public_id;
end;
$$;

revoke all on function public.publish_project(uuid) from public;
revoke all on function public.unpublish_project(uuid) from public;
revoke all on function public.regenerate_project_public_id(uuid) from public;
grant execute on function public.publish_project(uuid) to authenticated;
grant execute on function public.unpublish_project(uuid) to authenticated;
grant execute on function public.regenerate_project_public_id(uuid) to authenticated;
