create function private.valid_source_authors(p_authors text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select cardinality(p_authors) <= 50
    and not exists (
      select 1 from unnest(p_authors) as author(value)
      where length(btrim(author.value)) not between 1 and 300
    );
$$;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 500),
  authors text[] not null default '{}'::text[],
  publisher text check (publisher is null or length(publisher) <= 300),
  publication_year integer check (publication_year is null or publication_year between -999999 and 999999),
  isbn text check (isbn is null or length(isbn) <= 32),
  url text check (
    url is null or (length(url) <= 2048 and url ~* '^https?://')
  ),
  accessed_on date,
  citation_key text check (citation_key is null or length(citation_key) between 1 and 100),
  notes text check (notes is null or length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_authors_check check (private.valid_source_authors(authors))
);

create unique index sources_project_citation_key_unique
on public.sources (project_id, lower(citation_key))
where citation_key is not null;

create index sources_project_title_idx on public.sources (project_id, title);

create trigger sources_set_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

create table public.source_citations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  entity_id uuid not null,
  pages text check (pages is null or length(pages) <= 200),
  chapter text check (chapter is null or length(chapter) <= 300),
  quote text check (quote is null or length(quote) <= 5000),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, entity_type, entity_id, source_id)
);

create index source_citations_source_idx
on public.source_citations (project_id, source_id);

create index source_citations_entity_idx
on public.source_citations (project_id, entity_type, entity_id);

create trigger source_citations_set_updated_at
before update on public.source_citations
for each row execute function public.set_updated_at();

create function private.validate_source_citation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sources
    where sources.id = new.source_id and sources.project_id = new.project_id
  ) then
    raise foreign_key_violation using message = 'Source does not belong to project';
  end if;
  if new.entity_type = 'timeline_item' and not exists (
    select 1 from public.timeline_items
    where timeline_items.id = new.entity_id
      and timeline_items.project_id = new.project_id
      and timeline_items.deleted_at is null
  ) then
    raise foreign_key_violation using message = 'Timeline item does not belong to project';
  end if;
  if new.entity_type = 'timeline_event' and not exists (
    select 1 from public.timeline_events
    where timeline_events.id = new.entity_id
      and timeline_events.project_id = new.project_id
      and timeline_events.deleted_at is null
  ) then
    raise foreign_key_violation using message = 'Timeline event does not belong to project';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_source_citation() from public;

create trigger source_citations_validate
before insert or update of project_id, source_id, entity_type, entity_id
on public.source_citations
for each row execute function private.validate_source_citation();

create function public.replace_source_citations(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_citations jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  citation jsonb;
begin
  if p_entity_type not in ('timeline_item', 'timeline_event')
    or jsonb_typeof(p_citations) <> 'array'
    or jsonb_array_length(p_citations) > 100 then
    raise invalid_parameter_value using message = 'Invalid source citations payload';
  end if;
  delete from public.source_citations
  where project_id = p_project_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id;
  for citation in select value from jsonb_array_elements(p_citations) loop
    insert into public.source_citations (
      project_id, source_id, entity_type, entity_id,
      pages, chapter, quote, notes
    ) values (
      p_project_id, (citation ->> 'source_id')::uuid, p_entity_type, p_entity_id,
      nullif(citation ->> 'pages', ''), nullif(citation ->> 'chapter', ''),
      nullif(citation ->> 'quote', ''), nullif(citation ->> 'notes', '')
    );
  end loop;
end;
$$;

revoke all on function public.replace_source_citations(uuid, text, uuid, jsonb) from public;
grant execute on function public.replace_source_citations(uuid, text, uuid, jsonb) to authenticated;

create function private.remove_entity_source_citations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.source_citations
  where project_id = old.project_id
    and entity_type = case when tg_table_name = 'timeline_items'
      then 'timeline_item' else 'timeline_event' end
    and entity_id = old.id;
  return old;
end;
$$;

revoke all on function private.remove_entity_source_citations() from public;

create trigger timeline_items_remove_source_citations
after delete on public.timeline_items
for each row execute function private.remove_entity_source_citations();

create trigger timeline_events_remove_source_citations
after delete on public.timeline_events
for each row execute function private.remove_entity_source_citations();

alter table public.sources enable row level security;
alter table public.source_citations enable row level security;

create policy "Permitted users can read sources"
on public.sources for select to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = sources.project_id
    and (projects.owner_id = (select auth.uid()) or projects.visibility = 'public')
));

create policy "Anonymous users can read public sources"
on public.sources for select to anon
using (exists (
  select 1 from public.projects
  where projects.id = sources.project_id and projects.visibility = 'public'
));

create policy "Owners can insert sources"
on public.sources for insert to authenticated
with check (exists (
  select 1 from public.projects
  where projects.id = sources.project_id and projects.owner_id = (select auth.uid())
));

create policy "Owners can update sources"
on public.sources for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = sources.project_id and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects
  where projects.id = sources.project_id and projects.owner_id = (select auth.uid())
));

create policy "Owners can delete sources"
on public.sources for delete to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = sources.project_id and projects.owner_id = (select auth.uid())
));

create policy "Permitted users can read source citations"
on public.source_citations for select to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = source_citations.project_id
    and (
      projects.owner_id = (select auth.uid())
      or (
        projects.visibility = 'public'
        and (
          (source_citations.entity_type = 'timeline_item' and exists (
            select 1 from public.timeline_items
            where timeline_items.id = source_citations.entity_id
              and timeline_items.project_id = source_citations.project_id
              and timeline_items.deleted_at is null
          ))
          or (source_citations.entity_type = 'timeline_event' and exists (
            select 1 from public.timeline_events
            where timeline_events.id = source_citations.entity_id
              and timeline_events.project_id = source_citations.project_id
              and timeline_events.deleted_at is null
          ))
        )
      )
    )
));

create policy "Anonymous users can read public source citations"
on public.source_citations for select to anon
using (exists (
  select 1 from public.projects
  where projects.id = source_citations.project_id
    and projects.visibility = 'public'
    and (
      (source_citations.entity_type = 'timeline_item' and exists (
        select 1 from public.timeline_items
        where timeline_items.id = source_citations.entity_id
          and timeline_items.project_id = source_citations.project_id
          and timeline_items.deleted_at is null
      ))
      or (source_citations.entity_type = 'timeline_event' and exists (
        select 1 from public.timeline_events
        where timeline_events.id = source_citations.entity_id
          and timeline_events.project_id = source_citations.project_id
          and timeline_events.deleted_at is null
      ))
    )
));

create policy "Owners can insert source citations"
on public.source_citations for insert to authenticated
with check (exists (
  select 1 from public.projects
  where projects.id = source_citations.project_id and projects.owner_id = (select auth.uid())
));

create policy "Owners can update source citations"
on public.source_citations for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = source_citations.project_id and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects
  where projects.id = source_citations.project_id and projects.owner_id = (select auth.uid())
));

create policy "Owners can delete source citations"
on public.source_citations for delete to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = source_citations.project_id and projects.owner_id = (select auth.uid())
));

revoke all on table public.sources, public.source_citations from anon, authenticated;
grant select on table public.sources, public.source_citations to anon;
grant select, insert, update, delete on table public.sources, public.source_citations to authenticated;
grant all on table public.sources, public.source_citations to service_role;

insert into private.application_schema_versions (version, name, baseline_migration)
values (4, 'structured-sources', '20260728154018_phase_l7_structured_sources.sql');
