alter table public.entity_relationships
drop constraint entity_relationships_relation_type_check;

update public.entity_relationships
set relation_type = case relation_type
  when 'influence' then '影響'
  when 'reference' then '参照'
  when 'collaboration' then '協働'
  when 'other' then 'その他'
  else relation_type
end;

alter table public.entity_relationships
add column direction text not null default 'undirected',
add column line_style text not null default 'single',
add column source_marker text not null default 'none',
add column target_marker text not null default 'none',
add constraint entity_relationships_relation_type_check
  check (length(btrim(relation_type)) between 1 and 80),
add constraint entity_relationships_direction_check
  check (direction in ('directed', 'undirected')),
add constraint entity_relationships_line_style_check
  check (line_style in ('single', 'double')),
add constraint entity_relationships_source_marker_check
  check (source_marker in ('none', 'arrow')),
add constraint entity_relationships_target_marker_check
  check (target_marker in ('none', 'arrow')),
add constraint entity_relationships_direction_markers_check
  check (
    direction = case
      when source_marker = 'none' and target_marker = 'none'
        then 'undirected'
      else 'directed'
    end
  );

comment on table public.entity_relationships is
'Phase L14 semantic relationships. Japanese defaults are offered by the UI while relation_type remains open text for project-specific vocabulary.';

comment on column public.entity_relationships.line_style is
'single draws one orthogonal line; double draws two parallel orthogonal lines.';

comment on column public.entity_relationships.source_marker is
'Optional arrow marker at the source endpoint.';

comment on column public.entity_relationships.target_marker is
'Optional arrow marker at the target endpoint.';

alter function public.import_project_data(uuid, text, jsonb)
rename to import_project_data_v6;
revoke all on function public.import_project_data_v6(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.import_project_data_v6(uuid, text, jsonb)
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
  marked_payload jsonb := p_payload;
  destination_id uuid;
  item_map jsonb := '{}'::jsonb;
  event_map jsonb := '{}'::jsonb;
  source_row jsonb;
  relation_row jsonb;
  source_entity_id uuid;
  mapped_id uuid;
  source_mapped_id uuid;
  target_mapped_id uuid;
  imports_relationships boolean :=
    p_payload->'importSections' is null
    or p_payload->'importSections' ? 'relationships';
begin
  if p_payload ? 'timelineItems' then
    marked_payload := jsonb_set(
      marked_payload,
      '{timelineItems}',
      coalesce((
        select jsonb_agg(jsonb_set(
          item.value,
          '{externalUrl}',
          to_jsonb('urn:timeline-editor-import:l14:item:' || (item.value->>'id'))
        ))
        from jsonb_array_elements(p_payload->'timelineItems') item(value)
      ), '[]'::jsonb)
    );
  end if;
  if p_payload ? 'timelineEvents' then
    marked_payload := jsonb_set(
      marked_payload,
      '{timelineEvents}',
      coalesce((
        select jsonb_agg(jsonb_set(
          event.value,
          '{externalUrl}',
          to_jsonb('urn:timeline-editor-import:l14:event:' || (event.value->>'id'))
        ))
        from jsonb_array_elements(p_payload->'timelineEvents') event(value)
      ), '[]'::jsonb)
    );
  end if;

  destination_id := public.import_project_data_v6(
    p_target_project_id,
    p_mode,
    marked_payload
  );

  select coalesce(jsonb_object_agg(
    substring(item.external_url from length('urn:timeline-editor-import:l14:item:') + 1),
    item.id::text
  ), '{}'::jsonb)
  into item_map
  from public.timeline_items item
  where item.project_id = destination_id
    and item.external_url like 'urn:timeline-editor-import:l14:item:%';

  select coalesce(jsonb_object_agg(
    substring(event.external_url from length('urn:timeline-editor-import:l14:event:') + 1),
    event.id::text
  ), '{}'::jsonb)
  into event_map
  from public.timeline_events event
  where event.project_id = destination_id
    and event.external_url like 'urn:timeline-editor-import:l14:event:%';

  if imports_relationships then
    if p_mode = 'overwrite' then
      delete from public.entity_relationships
      where project_id = destination_id;
    end if;

    for relation_row in
      select value
      from jsonb_array_elements(coalesce(p_payload->'relationships', '[]'::jsonb))
    loop
      source_entity_id := (relation_row->>'sourceId')::uuid;
      source_mapped_id := case relation_row->>'sourceType'
        when 'timeline_item' then nullif(item_map->>source_entity_id::text, '')::uuid
        else nullif(event_map->>source_entity_id::text, '')::uuid
      end;
      if source_mapped_id is null then
        if relation_row->>'sourceType' = 'timeline_item' and exists (
          select 1 from public.timeline_items
          where project_id = destination_id and id = source_entity_id and deleted_at is null
        ) then source_mapped_id := source_entity_id;
        elsif relation_row->>'sourceType' = 'timeline_event' and exists (
          select 1 from public.timeline_events
          where project_id = destination_id and id = source_entity_id and deleted_at is null
        ) then source_mapped_id := source_entity_id;
        end if;
      end if;

      source_entity_id := (relation_row->>'targetId')::uuid;
      target_mapped_id := case relation_row->>'targetType'
        when 'timeline_item' then nullif(item_map->>source_entity_id::text, '')::uuid
        else nullif(event_map->>source_entity_id::text, '')::uuid
      end;
      if target_mapped_id is null then
        if relation_row->>'targetType' = 'timeline_item' and exists (
          select 1 from public.timeline_items
          where project_id = destination_id and id = source_entity_id and deleted_at is null
        ) then target_mapped_id := source_entity_id;
        elsif relation_row->>'targetType' = 'timeline_event' and exists (
          select 1 from public.timeline_events
          where project_id = destination_id and id = source_entity_id and deleted_at is null
        ) then target_mapped_id := source_entity_id;
        end if;
      end if;

      if source_mapped_id is not null and target_mapped_id is not null then
        insert into public.entity_relationships (
          project_id, source_type, source_id, target_type, target_id,
          relation_type, direction, line_style, source_marker, target_marker, note
        ) values (
          destination_id,
          relation_row->>'sourceType', source_mapped_id,
          relation_row->>'targetType', target_mapped_id,
          relation_row->>'relationType', relation_row->>'direction',
          relation_row->>'lineStyle', relation_row->>'sourceMarker',
          relation_row->>'targetMarker', nullif(relation_row->>'note', '')
        )
        on conflict (
          project_id, source_type, source_id, target_type, target_id, relation_type
        ) do update set
          direction = excluded.direction,
          line_style = excluded.line_style,
          source_marker = excluded.source_marker,
          target_marker = excluded.target_marker,
          note = excluded.note;
      end if;
    end loop;
  end if;

  for source_row in
    select value from jsonb_array_elements(coalesce(p_payload->'timelineItems', '[]'::jsonb))
  loop
    source_entity_id := (source_row->>'id')::uuid;
    mapped_id := nullif(item_map->>source_entity_id::text, '')::uuid;
    if mapped_id is not null then
      update public.timeline_items
      set external_url = nullif(source_row->>'externalUrl', '')
      where project_id = destination_id and id = mapped_id;
    end if;
  end loop;
  for source_row in
    select value from jsonb_array_elements(coalesce(p_payload->'timelineEvents', '[]'::jsonb))
  loop
    source_entity_id := (source_row->>'id')::uuid;
    mapped_id := nullif(event_map->>source_entity_id::text, '')::uuid;
    if mapped_id is not null then
      update public.timeline_events
      set external_url = nullif(source_row->>'externalUrl', '')
      where project_id = destination_id and id = mapped_id;
    end if;
  end loop;
  return destination_id;
end;
$$;

revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb)
to authenticated;

-- Preserve the L14 line presentation when L13 rewires relationships during a
-- merge. Replacing the two stable fragments avoids duplicating that long RPC.
do $$
declare
  function_definition text;
  patched_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.merge_timeline_entities(uuid,text,uuid,uuid)'::regprocedure
  );
  patched_definition := replace(
    function_definition,
    'project_id, source_type, source_id, target_type, target_id, relation_type, note',
    'project_id, source_type, source_id, target_type, target_id, relation_type, note, direction, line_style, source_marker, target_marker'
  );
  patched_definition := replace(
    patched_definition,
    'relation_type, note
  from public.entity_relationships',
    'relation_type, note, direction, line_style, source_marker, target_marker
  from public.entity_relationships'
  );
  if patched_definition = function_definition then
    raise exception 'Could not patch merge_timeline_entities for L14';
  end if;
  execute patched_definition;
end;
$$;

insert into private.application_schema_versions (version, name, baseline_migration)
values (7, 'semantic-relationships', '20260801114508_phase_l14_semantic_relationships.sql');
