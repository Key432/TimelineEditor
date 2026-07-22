create extension if not exists pgroonga with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create table public.search_documents (
  entity_type text not null check (
    entity_type in ('project', 'timeline_item', 'timeline_event')
  ),
  entity_id uuid not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  is_public boolean not null default false,
  title text not null,
  project_name text not null,
  content text not null,
  detail_path text not null,
  start_year integer,
  start_month integer,
  start_day integer,
  end_year integer,
  end_month integer,
  end_day integer,
  end_date_status text check (
    end_date_status is null
    or end_date_status in ('specified', 'ongoing', 'unknown')
  ),
  is_start_approximate boolean not null default false,
  is_end_approximate boolean not null default false,
  updated_at timestamptz not null,
  primary key (entity_type, entity_id)
);

comment on table public.search_documents is
'Denormalized PGroonga search index. Rows are maintained only by internal triggers; RLS limits reads to owners and public projects.';

create index search_documents_content_pgroonga_idx
on public.search_documents using pgroonga (content);

create index search_documents_project_type_idx
on public.search_documents (project_id, entity_type, updated_at desc);

create index search_documents_owner_idx
on public.search_documents (owner_id, updated_at desc);

create index search_documents_public_idx
on public.search_documents (updated_at desc)
where is_public;

alter table public.search_documents enable row level security;

create policy "Owners can search their documents"
on public.search_documents for select
to authenticated
using (
  owner_id = (select auth.uid())
  or is_public
);

create policy "Anonymous users can search public documents"
on public.search_documents for select
to anon
using (is_public);

revoke all on table public.search_documents from anon, authenticated;
grant select on table public.search_documents to anon, authenticated;
grant all on table public.search_documents to service_role;

create function private.sync_project_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.search_documents (
    entity_type,
    entity_id,
    project_id,
    owner_id,
    is_public,
    title,
    project_name,
    content,
    detail_path,
    updated_at
  )
  values (
    'project',
    new.id,
    new.id,
    new.owner_id,
    new.visibility = 'public',
    new.name,
    new.name,
    concat_ws(E'\n', new.name, new.description),
    '/projects/' || new.id::text || '/timeline',
    new.updated_at
  )
  on conflict (entity_type, entity_id) do update set
    owner_id = excluded.owner_id,
    is_public = excluded.is_public,
    title = excluded.title,
    project_name = excluded.project_name,
    content = excluded.content,
    detail_path = excluded.detail_path,
    updated_at = excluded.updated_at;

  update public.search_documents
  set
    owner_id = new.owner_id,
    is_public = new.visibility = 'public',
    project_name = new.name
  where project_id = new.id
    and entity_type <> 'project';

  return new;
end;
$$;

create function private.sync_timeline_item_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  type_name text;
begin
  select * into strict project_row
  from public.projects
  where id = new.project_id;

  select name into strict type_name
  from public.timeline_item_types
  where id = new.type_id and project_id = new.project_id;

  insert into public.search_documents (
    entity_type,
    entity_id,
    project_id,
    owner_id,
    is_public,
    title,
    project_name,
    content,
    detail_path,
    start_year,
    start_month,
    start_day,
    end_year,
    end_month,
    end_day,
    end_date_status,
    is_start_approximate,
    is_end_approximate,
    updated_at
  )
  values (
    'timeline_item',
    new.id,
    new.project_id,
    project_row.owner_id,
    project_row.visibility = 'public',
    new.title,
    project_row.name,
    concat_ws(
      E'\n',
      new.title,
      new.description,
      new.source_text,
      new.external_url,
      type_name
    ),
    '/projects/' || new.project_id::text || '/items/' || new.id::text,
    case when new.temporal_type = 'range' then new.start_year else new.point_year end,
    case when new.temporal_type = 'range' then new.start_month else new.point_month end,
    case when new.temporal_type = 'range' then new.start_day else new.point_day end,
    new.end_year,
    new.end_month,
    new.end_day,
    new.end_date_status,
    case when new.temporal_type = 'range'
      then new.is_start_approximate else new.is_point_approximate end,
    new.is_end_approximate,
    new.updated_at
  )
  on conflict (entity_type, entity_id) do update set
    project_id = excluded.project_id,
    owner_id = excluded.owner_id,
    is_public = excluded.is_public,
    title = excluded.title,
    project_name = excluded.project_name,
    content = excluded.content,
    detail_path = excluded.detail_path,
    start_year = excluded.start_year,
    start_month = excluded.start_month,
    start_day = excluded.start_day,
    end_year = excluded.end_year,
    end_month = excluded.end_month,
    end_day = excluded.end_day,
    end_date_status = excluded.end_date_status,
    is_start_approximate = excluded.is_start_approximate,
    is_end_approximate = excluded.is_end_approximate,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create function private.sync_timeline_event_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  type_name text;
begin
  select * into strict project_row
  from public.projects
  where id = new.project_id;

  select timeline_item_types.name into strict type_name
  from public.timeline_items
  join public.timeline_item_types
    on timeline_item_types.project_id = timeline_items.project_id
    and timeline_item_types.id = timeline_items.type_id
  where timeline_items.project_id = new.project_id
    and timeline_items.id = new.timeline_item_id;

  insert into public.search_documents (
    entity_type,
    entity_id,
    project_id,
    owner_id,
    is_public,
    title,
    project_name,
    content,
    detail_path,
    start_year,
    start_month,
    start_day,
    is_start_approximate,
    updated_at
  )
  values (
    'timeline_event',
    new.id,
    new.project_id,
    project_row.owner_id,
    project_row.visibility = 'public',
    new.title,
    project_row.name,
    concat_ws(
      E'\n',
      new.title,
      new.description,
      new.source_text,
      new.external_url,
      type_name
    ),
    '/projects/' || new.project_id::text || '/events/' || new.id::text,
    new.event_year,
    new.event_month,
    new.event_day,
    new.is_approximate,
    new.updated_at
  )
  on conflict (entity_type, entity_id) do update set
    project_id = excluded.project_id,
    owner_id = excluded.owner_id,
    is_public = excluded.is_public,
    title = excluded.title,
    project_name = excluded.project_name,
    content = excluded.content,
    detail_path = excluded.detail_path,
    start_year = excluded.start_year,
    start_month = excluded.start_month,
    start_day = excluded.start_day,
    end_year = null,
    end_month = null,
    end_day = null,
    end_date_status = null,
    is_start_approximate = excluded.is_start_approximate,
    is_end_approximate = false,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create function private.delete_search_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.search_documents
  where entity_type = tg_argv[0]
    and entity_id = old.id;
  return old;
end;
$$;

create function private.resync_item_type_search_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.timeline_items
    set updated_at = updated_at
    where project_id = new.project_id and type_id = new.id;

    update public.timeline_events
    set updated_at = updated_at
    where project_id = new.project_id
      and timeline_item_id in (
        select id from public.timeline_items
        where project_id = new.project_id and type_id = new.id
      );
  end if;
  return new;
end;
$$;

revoke all on function private.sync_project_search_document() from public;
revoke all on function private.sync_timeline_item_search_document() from public;
revoke all on function private.sync_timeline_event_search_document() from public;
revoke all on function private.delete_search_document() from public;
revoke all on function private.resync_item_type_search_documents() from public;

create trigger projects_sync_search_document
after insert or update of owner_id, name, description, visibility
on public.projects
for each row execute function private.sync_project_search_document();

create trigger timeline_items_sync_search_document
after insert or update
on public.timeline_items
for each row execute function private.sync_timeline_item_search_document();

create trigger timeline_items_delete_search_document
after delete on public.timeline_items
for each row execute function private.delete_search_document('timeline_item');

create trigger timeline_events_sync_search_document
after insert or update
on public.timeline_events
for each row execute function private.sync_timeline_event_search_document();

create trigger timeline_events_delete_search_document
after delete on public.timeline_events
for each row execute function private.delete_search_document('timeline_event');

create trigger timeline_item_types_resync_search_documents
after update of name on public.timeline_item_types
for each row execute function private.resync_item_type_search_documents();

insert into public.search_documents (
  entity_type,
  entity_id,
  project_id,
  owner_id,
  is_public,
  title,
  project_name,
  content,
  detail_path,
  updated_at
)
select
  'project',
  id,
  id,
  owner_id,
  visibility = 'public',
  name,
  name,
  concat_ws(E'\n', name, description),
  '/projects/' || id::text || '/timeline',
  updated_at
from public.projects;

insert into public.search_documents (
  entity_type,
  entity_id,
  project_id,
  owner_id,
  is_public,
  title,
  project_name,
  content,
  detail_path,
  start_year,
  start_month,
  start_day,
  end_year,
  end_month,
  end_day,
  end_date_status,
  is_start_approximate,
  is_end_approximate,
  updated_at
)
select
  'timeline_item',
  item.id,
  item.project_id,
  project.owner_id,
  project.visibility = 'public',
  item.title,
  project.name,
  concat_ws(
    E'\n',
    item.title,
    item.description,
    item.source_text,
    item.external_url,
    item_type.name
  ),
  '/projects/' || item.project_id::text || '/items/' || item.id::text,
  case when item.temporal_type = 'range' then item.start_year else item.point_year end,
  case when item.temporal_type = 'range' then item.start_month else item.point_month end,
  case when item.temporal_type = 'range' then item.start_day else item.point_day end,
  item.end_year,
  item.end_month,
  item.end_day,
  item.end_date_status,
  case when item.temporal_type = 'range'
    then item.is_start_approximate else item.is_point_approximate end,
  item.is_end_approximate,
  item.updated_at
from public.timeline_items as item
join public.projects as project on project.id = item.project_id
join public.timeline_item_types as item_type on item_type.id = item.type_id;

insert into public.search_documents (
  entity_type,
  entity_id,
  project_id,
  owner_id,
  is_public,
  title,
  project_name,
  content,
  detail_path,
  start_year,
  start_month,
  start_day,
  is_start_approximate,
  updated_at
)
select
  'timeline_event',
  event.id,
  event.project_id,
  project.owner_id,
  project.visibility = 'public',
  event.title,
  project.name,
  concat_ws(
    E'\n',
    event.title,
    event.description,
    event.source_text,
    event.external_url,
    item_type.name
  ),
  '/projects/' || event.project_id::text || '/events/' || event.id::text,
  event.event_year,
  event.event_month,
  event.event_day,
  event.is_approximate,
  event.updated_at
from public.timeline_events as event
join public.projects as project on project.id = event.project_id
join public.timeline_items as item on item.id = event.timeline_item_id
join public.timeline_item_types as item_type on item_type.id = item.type_id;

create function public.search_global_documents(
  p_query text,
  p_entity_type text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  entity_type text,
  entity_id uuid,
  project_id uuid,
  title text,
  project_name text,
  content text,
  detail_path text,
  start_year integer,
  start_month integer,
  start_day integer,
  end_year integer,
  end_month integer,
  end_day integer,
  end_date_status text,
  is_start_approximate boolean,
  is_end_approximate boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    document.entity_type,
    document.entity_id,
    document.project_id,
    document.title,
    document.project_name,
    document.content,
    document.detail_path,
    document.start_year,
    document.start_month,
    document.start_day,
    document.end_year,
    document.end_month,
    document.end_day,
    document.end_date_status,
    document.is_start_approximate,
    document.is_end_approximate,
    count(*) over ()
  from public.search_documents as document
  where length(btrim(p_query)) > 0
    and document.content operator(extensions.&@~)
      extensions.pgroonga_query_escape(btrim(p_query))
    and (p_entity_type is null or document.entity_type = p_entity_type)
  order by document.updated_at desc, document.entity_type, document.entity_id
  limit least(greatest(p_page_size, 1), 50)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 50);
$$;

create function public.match_project_search_documents(
  p_project_id uuid,
  p_query text
)
returns table (entity_type text, entity_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select document.entity_type, document.entity_id
  from public.search_documents as document
  where document.project_id = p_project_id
    and document.entity_type in ('timeline_item', 'timeline_event')
    and length(btrim(p_query)) > 0
    and document.content operator(extensions.&@~)
      extensions.pgroonga_query_escape(btrim(p_query));
$$;

revoke all on function public.search_global_documents(text, text, integer, integer)
from public;
revoke all on function public.match_project_search_documents(uuid, text)
from public;
grant execute on function public.search_global_documents(text, text, integer, integer)
to anon, authenticated;
grant execute on function public.match_project_search_documents(uuid, text)
to authenticated;
