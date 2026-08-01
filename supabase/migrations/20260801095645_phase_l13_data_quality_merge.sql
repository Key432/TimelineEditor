create table public.entity_merge_operations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  survivor_id uuid not null,
  merged_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  merged_target_updated_at timestamptz not null,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  check (survivor_id <> merged_id),
  check (pg_column_size(snapshot) <= 5242880)
);

comment on table public.entity_merge_operations is
'Bounded inverse snapshots for Phase L13 entity merge Undo. Analysis and similarity results are never persisted.';

create index entity_merge_operations_project_created_idx
on public.entity_merge_operations (project_id, created_at desc);

alter table public.entity_merge_operations enable row level security;

create policy "Owners can manage entity merge operations"
on public.entity_merge_operations for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = entity_merge_operations.project_id
      and projects.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = entity_merge_operations.project_id
      and projects.owner_id = (select auth.uid())
  )
);

revoke all on table public.entity_merge_operations from anon, authenticated;
grant select, insert, update, delete on table public.entity_merge_operations to authenticated;
grant all on table public.entity_merge_operations to service_role;

create function private.merge_link_token(
  p_content text,
  p_entity_type text,
  p_source_id uuid,
  p_target_id uuid
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when p_content is null then null else replace(
    p_content,
    '[[' || case p_entity_type when 'timeline_item' then 'item' else 'event' end
      || ':' || p_source_id::text || '|',
    '[[' || case p_entity_type when 'timeline_item' then 'item' else 'event' end
      || ':' || p_target_id::text || '|'
  ) end;
$$;

revoke all on function private.merge_link_token(text, text, uuid, uuid) from public;
grant execute on function private.merge_link_token(text, text, uuid, uuid)
to authenticated, service_role;

create function public.merge_timeline_entities(
  p_project_id uuid,
  p_entity_type text,
  p_survivor_id uuid,
  p_merged_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_snapshot jsonb;
  v_operation_id uuid;
  v_target_updated_at timestamptz;
  v_affected_event_ids uuid[] := '{}'::uuid[];
begin
  if p_entity_type not in ('timeline_item', 'timeline_event')
    or p_survivor_id = p_merged_id then
    raise invalid_parameter_value using message = 'Invalid merge request';
  end if;
  if v_owner_id is null or not exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = v_owner_id
  ) then
    raise insufficient_privilege using message = 'Project owner required';
  end if;

  if p_entity_type = 'timeline_item' then
    perform 1 from public.timeline_items
    where project_id = p_project_id
      and id in (p_survivor_id, p_merged_id)
      and deleted_at is null
    for update;
    if (select count(*) from public.timeline_items where project_id = p_project_id
      and id in (p_survivor_id, p_merged_id) and deleted_at is null) <> 2 then
      raise foreign_key_violation using message = 'Merge items not found';
    end if;
  else
    perform 1 from public.timeline_events
    where project_id = p_project_id
      and id in (p_survivor_id, p_merged_id)
      and deleted_at is null
    for update;
    if (select count(*) from public.timeline_events where project_id = p_project_id
      and id in (p_survivor_id, p_merged_id) and deleted_at is null) <> 2 then
      raise foreign_key_violation using message = 'Merge events not found';
    end if;
  end if;

  select jsonb_build_object(
    'entities', case when p_entity_type = 'timeline_item' then (
      select jsonb_agg(to_jsonb(entity)) from public.timeline_items entity
      where entity.project_id = p_project_id and entity.id in (p_survivor_id, p_merged_id)
    ) else (
      select jsonb_agg(to_jsonb(entity)) from public.timeline_events entity
      where entity.project_id = p_project_id and entity.id in (p_survivor_id, p_merged_id)
    ) end,
    'contentRows', (
      select coalesce(jsonb_agg(row_data), '[]'::jsonb) from (
        select jsonb_build_object('entityType', 'timeline_item', 'id', id, 'description', description) row_data
        from public.timeline_items where project_id = p_project_id and deleted_at is null
          and (id in (p_survivor_id, p_merged_id) or description like '%:' || p_merged_id::text || '|%')
        union all
        select jsonb_build_object('entityType', 'timeline_event', 'id', id, 'description', description)
        from public.timeline_events where project_id = p_project_id and deleted_at is null
          and (id in (p_survivor_id, p_merged_id) or description like '%:' || p_merged_id::text || '|%')
      ) content
    ),
    'itemTags', (select coalesce(jsonb_agg(to_jsonb(tag)), '[]'::jsonb)
      from public.timeline_item_tags tag where project_id = p_project_id
        and p_entity_type = 'timeline_item' and timeline_item_id in (p_survivor_id, p_merged_id)),
    'eventTags', (select coalesce(jsonb_agg(to_jsonb(tag)), '[]'::jsonb)
      from public.timeline_event_tags tag where project_id = p_project_id
        and p_entity_type = 'timeline_event' and timeline_event_id in (p_survivor_id, p_merged_id)),
    'citations', (select coalesce(jsonb_agg(to_jsonb(citation)), '[]'::jsonb)
      from public.source_citations citation where project_id = p_project_id
        and entity_type = p_entity_type and entity_id in (p_survivor_id, p_merged_id)),
    'customValues', (select coalesce(jsonb_agg(to_jsonb(value)), '[]'::jsonb)
      from public.custom_field_values value where project_id = p_project_id
        and (
          (entity_type = p_entity_type and entity_id in (p_survivor_id, p_merged_id))
          or (reference_entity_type = p_entity_type and reference_entity_id = p_merged_id)
        )),
    'parentLinks', (select coalesce(jsonb_agg(to_jsonb(link)), '[]'::jsonb)
      from public.timeline_event_item_links link where project_id = p_project_id and (
        (p_entity_type = 'timeline_item' and timeline_item_id in (p_survivor_id, p_merged_id))
        or (p_entity_type = 'timeline_event' and timeline_event_id in (p_survivor_id, p_merged_id))
      )),
    'relationships', (select coalesce(jsonb_agg(to_jsonb(relation)), '[]'::jsonb)
      from public.entity_relationships relation where project_id = p_project_id and (
        (source_type = p_entity_type and source_id in (p_survivor_id, p_merged_id))
        or (target_type = p_entity_type and target_id in (p_survivor_id, p_merged_id))
      ))
  ) into v_snapshot;

  if pg_column_size(v_snapshot) > 5242880 then
    raise program_limit_exceeded using message = 'Merge Undo snapshot is too large';
  end if;

  if p_entity_type = 'timeline_item' then
    select array_agg(distinct timeline_event_id) into v_affected_event_ids
    from public.timeline_event_item_links
    where project_id = p_project_id and timeline_item_id = p_merged_id;

    insert into public.timeline_item_tags (project_id, timeline_item_id, tag_id)
    select project_id, p_survivor_id, tag_id from public.timeline_item_tags
    where project_id = p_project_id and timeline_item_id = p_merged_id
    on conflict do nothing;

    delete from public.timeline_event_item_links
    where project_id = p_project_id and timeline_item_id = p_merged_id;
    insert into public.timeline_event_item_links (
      project_id, timeline_event_id, timeline_item_id, sort_order
    )
    select p_project_id, event_id, p_survivor_id, 100000 + ordinality
    from unnest(coalesce(v_affected_event_ids, '{}'::uuid[])) with ordinality affected(event_id, ordinality)
    where not exists (
      select 1 from public.timeline_event_item_links existing
      where existing.timeline_event_id = affected.event_id
        and existing.timeline_item_id = p_survivor_id
    );
    update public.timeline_event_item_links set sort_order = sort_order + 200000
    where timeline_event_id = any(coalesce(v_affected_event_ids, '{}'::uuid[]));
    with ordered as (
      select timeline_event_id, timeline_item_id,
        row_number() over (partition by timeline_event_id order by sort_order, timeline_item_id) - 1 next_order
      from public.timeline_event_item_links
      where timeline_event_id = any(coalesce(v_affected_event_ids, '{}'::uuid[]))
    )
    update public.timeline_event_item_links link set sort_order = ordered.next_order
    from ordered where link.timeline_event_id = ordered.timeline_event_id
      and link.timeline_item_id = ordered.timeline_item_id;
    update public.timeline_events event set timeline_item_id = (
      select timeline_item_id from public.timeline_event_item_links link
      where link.timeline_event_id = event.id order by sort_order limit 1
    ) where event.id = any(coalesce(v_affected_event_ids, '{}'::uuid[]));

    update public.timeline_items target set
      aliases = array(select distinct alias from unnest(
        target.aliases || source.aliases || array[source.title]
      ) alias where btrim(alias) <> '' and lower(btrim(alias)) <> lower(btrim(target.title))),
      description = case
        when source.description is null then target.description
        when target.description is null then source.description
        else target.description || E'\n\n---\n\n' || source.description end,
      source_text = case
        when source.source_text is null then target.source_text
        when target.source_text is null then source.source_text
        else target.source_text || E'\n\n' || source.source_text end
    from public.timeline_items source
    where target.project_id = p_project_id and target.id = p_survivor_id
      and source.project_id = p_project_id and source.id = p_merged_id;
  else
    insert into public.timeline_event_tags (project_id, timeline_event_id, tag_id)
    select project_id, p_survivor_id, tag_id from public.timeline_event_tags
    where project_id = p_project_id and timeline_event_id = p_merged_id
    on conflict do nothing;

    delete from public.timeline_event_item_links
    where project_id = p_project_id and timeline_event_id in (p_survivor_id, p_merged_id);
    insert into public.timeline_event_item_links (
      project_id, timeline_event_id, timeline_item_id, sort_order
    )
    select p_project_id, p_survivor_id, timeline_item_id,
      row_number() over (order by minimum_order, timeline_item_id) - 1
    from (
      select timeline_item_id, min(sort_order) minimum_order
      from jsonb_populate_recordset(null::public.timeline_event_item_links, v_snapshot->'parentLinks')
      group by timeline_item_id
    ) parents;
    update public.timeline_events set timeline_item_id = (
      select timeline_item_id from public.timeline_event_item_links
      where timeline_event_id = p_survivor_id order by sort_order limit 1
    ) where project_id = p_project_id and id = p_survivor_id;

    update public.timeline_events target set
      aliases = array(select distinct alias from unnest(
        target.aliases || source.aliases || array[source.title]
      ) alias where btrim(alias) <> '' and lower(btrim(alias)) <> lower(btrim(target.title))),
      description = case
        when source.description is null then target.description
        when target.description is null then source.description
        else target.description || E'\n\n---\n\n' || source.description end,
      source_text = case
        when source.source_text is null then target.source_text
        when target.source_text is null then source.source_text
        else target.source_text || E'\n\n' || source.source_text end
    from public.timeline_events source
    where target.project_id = p_project_id and target.id = p_survivor_id
      and source.project_id = p_project_id and source.id = p_merged_id;
  end if;

  insert into public.source_citations (
    project_id, source_id, entity_type, entity_id, pages, chapter, quote, notes
  )
  select project_id, source_id, entity_type, p_survivor_id, pages, chapter, quote, notes
  from public.source_citations where project_id = p_project_id
    and entity_type = p_entity_type and entity_id = p_merged_id
  on conflict (project_id, entity_type, entity_id, source_id) do nothing;
  delete from public.source_citations where project_id = p_project_id
    and entity_type = p_entity_type and entity_id = p_merged_id;

  insert into public.custom_field_values
  select project_id, field_id, entity_type, p_survivor_id, text_value, number_value,
    boolean_value, multi_value, date_era, date_precision, date_year, date_month,
    date_day, date_original_text, date_calendar, reference_entity_type,
    reference_entity_id, created_at, updated_at
  from public.custom_field_values where project_id = p_project_id
    and entity_type = p_entity_type and entity_id = p_merged_id
  on conflict (field_id, entity_type, entity_id) do nothing;
  delete from public.custom_field_values where project_id = p_project_id
    and entity_type = p_entity_type and entity_id = p_merged_id;
  update public.custom_field_values set reference_entity_id = p_survivor_id
  where project_id = p_project_id and reference_entity_type = p_entity_type
    and reference_entity_id = p_merged_id;

  insert into public.entity_relationships (
    project_id, source_type, source_id, target_type, target_id, relation_type, note
  )
  select project_id, source_type,
    case when source_type = p_entity_type and source_id = p_merged_id then p_survivor_id else source_id end,
    target_type,
    case when target_type = p_entity_type and target_id = p_merged_id then p_survivor_id else target_id end,
    relation_type, note
  from public.entity_relationships
  where project_id = p_project_id and (
    (source_type = p_entity_type and source_id = p_merged_id)
    or (target_type = p_entity_type and target_id = p_merged_id)
  )
  and not (
    source_type = target_type
    and (case when source_type = p_entity_type and source_id = p_merged_id then p_survivor_id else source_id end)
      = (case when target_type = p_entity_type and target_id = p_merged_id then p_survivor_id else target_id end)
  ) on conflict do nothing;
  delete from public.entity_relationships where project_id = p_project_id and (
    (source_type = p_entity_type and source_id = p_merged_id)
    or (target_type = p_entity_type and target_id = p_merged_id)
  );

  update public.timeline_items set description = private.merge_link_token(
    description, p_entity_type, p_merged_id, p_survivor_id
  ) where project_id = p_project_id and deleted_at is null
    and description like '%:' || p_merged_id::text || '|%';
  update public.timeline_events set description = private.merge_link_token(
    description, p_entity_type, p_merged_id, p_survivor_id
  ) where project_id = p_project_id and deleted_at is null
    and description like '%:' || p_merged_id::text || '|%';

  if p_entity_type = 'timeline_item' then
    update public.timeline_items set deleted_at = now(), deleted_by = v_owner_id,
      trash_group_id = gen_random_uuid()
    where project_id = p_project_id and id = p_merged_id;
    select updated_at into v_target_updated_at from public.timeline_items
    where project_id = p_project_id and id = p_survivor_id;
  else
    update public.timeline_events set deleted_at = now(), deleted_by = v_owner_id,
      trash_group_id = gen_random_uuid()
    where project_id = p_project_id and id = p_merged_id;
    select updated_at into v_target_updated_at from public.timeline_events
    where project_id = p_project_id and id = p_survivor_id;
  end if;

  insert into public.entity_merge_operations (
    project_id, owner_id, entity_type, survivor_id, merged_id,
    snapshot, merged_target_updated_at
  ) values (
    p_project_id, v_owner_id, p_entity_type, p_survivor_id, p_merged_id,
    v_snapshot, v_target_updated_at
  ) returning id into v_operation_id;

  delete from public.entity_merge_operations
  where project_id = p_project_id and owner_id = v_owner_id
    and (created_at < now() - interval '10 days' or id in (
      select id from public.entity_merge_operations
      where project_id = p_project_id and owner_id = v_owner_id
      order by created_at desc, id desc offset 50
    ));
  return v_operation_id;
end;
$$;

revoke all on function public.merge_timeline_entities(uuid, text, uuid, uuid) from public;
grant execute on function public.merge_timeline_entities(uuid, text, uuid, uuid) to authenticated;

create function public.undo_timeline_entity_merge(
  p_project_id uuid,
  p_operation_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation public.entity_merge_operations%rowtype;
  entity jsonb;
  content_row jsonb;
begin
  select * into operation from public.entity_merge_operations
  where project_id = p_project_id and id = p_operation_id
    and owner_id = (select auth.uid()) and undone_at is null
    and created_at >= now() - interval '10 days'
  for update;
  if not found then return false; end if;

  if operation.entity_type = 'timeline_item' then
    if not exists (select 1 from public.timeline_items where project_id = p_project_id
      and id = operation.survivor_id and updated_at = operation.merged_target_updated_at) then
      raise serialization_failure using message = 'Merge target changed after merge';
    end if;
    for entity in select value from jsonb_array_elements(operation.snapshot->'entities') loop
      update public.timeline_items set
        aliases = array(select jsonb_array_elements_text(entity->'aliases')),
        description = entity->>'description', source_text = entity->>'source_text',
        deleted_at = (entity->>'deleted_at')::timestamptz,
        deleted_by = (entity->>'deleted_by')::uuid,
        trash_group_id = (entity->>'trash_group_id')::uuid
      where project_id = p_project_id and id = (entity->>'id')::uuid;
    end loop;
    delete from public.timeline_item_tags where project_id = p_project_id
      and timeline_item_id in (operation.survivor_id, operation.merged_id);
    insert into public.timeline_item_tags
    select * from jsonb_populate_recordset(null::public.timeline_item_tags, operation.snapshot->'itemTags');
    delete from public.timeline_event_item_links where project_id = p_project_id
      and timeline_item_id in (operation.survivor_id, operation.merged_id);
  else
    if not exists (select 1 from public.timeline_events where project_id = p_project_id
      and id = operation.survivor_id and updated_at = operation.merged_target_updated_at) then
      raise serialization_failure using message = 'Merge target changed after merge';
    end if;
    for entity in select value from jsonb_array_elements(operation.snapshot->'entities') loop
      update public.timeline_events set
        aliases = array(select jsonb_array_elements_text(entity->'aliases')),
        description = entity->>'description', source_text = entity->>'source_text',
        deleted_at = (entity->>'deleted_at')::timestamptz,
        deleted_by = (entity->>'deleted_by')::uuid,
        trash_group_id = (entity->>'trash_group_id')::uuid
      where project_id = p_project_id and id = (entity->>'id')::uuid;
    end loop;
    delete from public.timeline_event_tags where project_id = p_project_id
      and timeline_event_id in (operation.survivor_id, operation.merged_id);
    insert into public.timeline_event_tags
    select * from jsonb_populate_recordset(null::public.timeline_event_tags, operation.snapshot->'eventTags');
    delete from public.timeline_event_item_links where project_id = p_project_id
      and timeline_event_id in (operation.survivor_id, operation.merged_id);
  end if;

  for content_row in select value from jsonb_array_elements(operation.snapshot->'contentRows') loop
    if content_row->>'entityType' = 'timeline_item' then
      update public.timeline_items set description = content_row->>'description'
      where project_id = p_project_id and id = (content_row->>'id')::uuid;
    else
      update public.timeline_events set description = content_row->>'description'
      where project_id = p_project_id and id = (content_row->>'id')::uuid;
    end if;
  end loop;

  delete from public.source_citations where project_id = p_project_id
    and entity_type = operation.entity_type
    and entity_id in (operation.survivor_id, operation.merged_id);
  insert into public.source_citations
  select * from jsonb_populate_recordset(null::public.source_citations, operation.snapshot->'citations');
  delete from public.custom_field_values where project_id = p_project_id
    and entity_type = operation.entity_type
    and entity_id in (operation.survivor_id, operation.merged_id);
  delete from public.custom_field_values current_value
  using jsonb_populate_recordset(
    null::public.custom_field_values,
    operation.snapshot->'customValues'
  ) snapshot_value
  where current_value.project_id = snapshot_value.project_id
    and current_value.field_id = snapshot_value.field_id
    and current_value.entity_type = snapshot_value.entity_type
    and current_value.entity_id = snapshot_value.entity_id;
  insert into public.custom_field_values
  select * from jsonb_populate_recordset(null::public.custom_field_values, operation.snapshot->'customValues');
  insert into public.timeline_event_item_links
  select * from jsonb_populate_recordset(null::public.timeline_event_item_links, operation.snapshot->'parentLinks');
  update public.timeline_events event set timeline_item_id = (
    select timeline_item_id from public.timeline_event_item_links link
    where link.timeline_event_id = event.id order by sort_order limit 1
  ) where project_id = p_project_id and (
    (operation.entity_type = 'timeline_event' and id in (operation.survivor_id, operation.merged_id))
    or (operation.entity_type = 'timeline_item' and exists (
      select 1 from public.timeline_event_item_links link
      where link.timeline_event_id = event.id
        and link.timeline_item_id in (operation.survivor_id, operation.merged_id)
    ))
  );

  delete from public.entity_relationships where project_id = p_project_id and (
    (source_type = operation.entity_type and source_id in (operation.survivor_id, operation.merged_id))
    or (target_type = operation.entity_type and target_id in (operation.survivor_id, operation.merged_id))
  );
  insert into public.entity_relationships
  select * from jsonb_populate_recordset(null::public.entity_relationships, operation.snapshot->'relationships');

  update public.entity_merge_operations set undone_at = now()
  where id = operation.id;
  return true;
end;
$$;

revoke all on function public.undo_timeline_entity_merge(uuid, uuid) from public;
grant execute on function public.undo_timeline_entity_merge(uuid, uuid) to authenticated;
