create table public.tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  color text not null default '#E5E7EB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  description text check (description is null or length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, normalized_name),
  unique (project_id, id)
);

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  color text not null default '#FF3399' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  marker_shape text not null default 'circle' check (
    marker_shape in ('circle', 'square', 'diamond', 'triangle', 'star', 'hexagon')
  ),
  description text check (description is null or length(description) <= 1000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, normalized_name),
  unique (project_id, id)
);

alter table public.timeline_events
add constraint timeline_events_project_id_id_key unique (project_id, id);

alter table public.timeline_events
add column event_type_id uuid,
add constraint timeline_events_event_type_project_fk
  foreign key (project_id, event_type_id)
  references public.event_types (project_id, id);

create index timeline_events_project_event_type_idx
on public.timeline_events (project_id, event_type_id)
where deleted_at is null;

create table public.timeline_item_tags (
  project_id uuid not null references public.projects (id) on delete cascade,
  timeline_item_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (timeline_item_id, tag_id),
  foreign key (project_id, timeline_item_id)
    references public.timeline_items (project_id, id) on delete cascade,
  foreign key (project_id, tag_id)
    references public.tags (project_id, id) on delete cascade
);

create table public.timeline_event_tags (
  project_id uuid not null references public.projects (id) on delete cascade,
  timeline_event_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (timeline_event_id, tag_id),
  foreign key (project_id, timeline_event_id)
    references public.timeline_events (project_id, id) on delete cascade,
  foreign key (project_id, tag_id)
    references public.tags (project_id, id) on delete cascade
);

create index timeline_item_tags_project_tag_idx
on public.timeline_item_tags (project_id, tag_id, timeline_item_id);
create index timeline_event_tags_project_tag_idx
on public.timeline_event_tags (project_id, tag_id, timeline_event_id);

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  scope text not null default 'project' check (scope in ('project', 'type')),
  target_type_id uuid,
  name text not null check (length(btrim(name)) between 1 and 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  field_type text not null check (field_type in (
    'text', 'multiline', 'number', 'boolean', 'single_select',
    'multi_select', 'url', 'historical_date', 'entity_reference'
  )),
  is_required boolean not null default false,
  options text[] not null default '{}',
  description text check (description is null or length(description) <= 1000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'project' and target_type_id is null) or (scope = 'type' and target_type_id is not null)),
  check (cardinality(options) <= 100),
  unique nulls not distinct (project_id, entity_type, target_type_id, normalized_name),
  unique (project_id, id)
);

create table public.custom_field_values (
  project_id uuid not null references public.projects (id) on delete cascade,
  field_id uuid not null,
  entity_type text not null check (entity_type in ('timeline_item', 'timeline_event')),
  entity_id uuid not null,
  text_value text,
  number_value numeric,
  boolean_value boolean,
  multi_value text[],
  date_era text check (date_era is null or date_era in ('ce', 'bce')),
  date_precision text check (date_precision is null or date_precision in ('day', 'month', 'year', 'decade', 'century')),
  date_year integer check (date_year is null or date_year >= 1),
  date_month integer check (date_month is null or date_month between 1 and 12),
  date_day integer check (date_day is null or date_day between 1 and 31),
  date_original_text text,
  date_calendar text,
  reference_entity_type text check (reference_entity_type is null or reference_entity_type in ('timeline_item', 'timeline_event')),
  reference_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (field_id, entity_type, entity_id),
  foreign key (project_id, field_id)
    references public.custom_field_definitions (project_id, id) on delete cascade,
  check (date_day is null or date_month is not null),
  check ((reference_entity_type is null) = (reference_entity_id is null)),
  check (num_nonnulls(text_value, number_value, boolean_value, multi_value, date_year, reference_entity_id) = 1)
);

create index custom_field_definitions_project_entity_idx
on public.custom_field_definitions (project_id, entity_type, sort_order, id);
create index custom_field_values_entity_idx
on public.custom_field_values (project_id, entity_type, entity_id);

create trigger tags_set_updated_at before update on public.tags
for each row execute function public.set_updated_at();
create trigger event_types_set_updated_at before update on public.event_types
for each row execute function public.set_updated_at();
create trigger custom_field_definitions_set_updated_at before update on public.custom_field_definitions
for each row execute function public.set_updated_at();
create trigger custom_field_values_set_updated_at before update on public.custom_field_values
for each row execute function public.set_updated_at();

create function public.validate_custom_field_definition()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.scope = 'type' and new.entity_type = 'timeline_item' and not exists (
    select 1 from public.timeline_item_types where project_id = new.project_id and id = new.target_type_id
  ) then raise foreign_key_violation using message = 'Timeline item type not found'; end if;
  if new.scope = 'type' and new.entity_type = 'timeline_event' and not exists (
    select 1 from public.event_types where project_id = new.project_id and id = new.target_type_id
  ) then raise foreign_key_violation using message = 'Timeline event type not found'; end if;
  return new;
end $$;
revoke all on function public.validate_custom_field_definition() from public;
grant execute on function public.validate_custom_field_definition() to authenticated, service_role;
create trigger custom_field_definitions_validate before insert or update on public.custom_field_definitions
for each row execute function public.validate_custom_field_definition();

create function public.prevent_custom_field_target_type_delete()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_entity_type text;
begin
  target_entity_type := case tg_table_name
    when 'timeline_item_types' then 'timeline_item'
    else 'timeline_event'
  end;
  if exists (
    select 1 from public.custom_field_definitions
    where project_id = old.project_id
      and entity_type = target_entity_type
      and scope = 'type'
      and target_type_id = old.id
  ) then
    raise foreign_key_violation using message = 'The type is used by a custom field definition';
  end if;
  return old;
end $$;
revoke all on function public.prevent_custom_field_target_type_delete() from public;
grant execute on function public.prevent_custom_field_target_type_delete() to authenticated, service_role;
create trigger timeline_item_types_custom_field_restrict
before delete on public.timeline_item_types
for each row execute function public.prevent_custom_field_target_type_delete();
create trigger event_types_custom_field_restrict
before delete on public.event_types
for each row execute function public.prevent_custom_field_target_type_delete();

create function public.validate_custom_field_value()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare definition public.custom_field_definitions%rowtype;
begin
  select * into definition from public.custom_field_definitions
  where project_id = new.project_id and id = new.field_id;
  if not found or definition.entity_type <> new.entity_type then
    raise check_violation using message = 'Custom field does not apply to this entity';
  end if;
  if new.entity_type = 'timeline_item' and not exists (
    select 1 from public.timeline_items where project_id = new.project_id and id = new.entity_id
  ) then raise foreign_key_violation using message = 'Timeline item not found'; end if;
  if new.entity_type = 'timeline_event' and not exists (
    select 1 from public.timeline_events where project_id = new.project_id and id = new.entity_id
  ) then raise foreign_key_violation using message = 'Timeline event not found'; end if;
  if definition.scope = 'type' and (
    (new.entity_type = 'timeline_item' and not exists (
      select 1 from public.timeline_items where project_id = new.project_id and id = new.entity_id and type_id = definition.target_type_id
    )) or
    (new.entity_type = 'timeline_event' and not exists (
      select 1 from public.timeline_events where project_id = new.project_id and id = new.entity_id and event_type_id = definition.target_type_id
    ))
  ) then raise check_violation using message = 'Custom field does not apply to the entity type'; end if;
  if definition.field_type in ('text','multiline','single_select','url') and new.text_value is null then
    raise check_violation using message = 'Expected text custom field value';
  elsif definition.field_type = 'number' and new.number_value is null then
    raise check_violation using message = 'Expected number custom field value';
  elsif definition.field_type = 'boolean' and new.boolean_value is null then
    raise check_violation using message = 'Expected boolean custom field value';
  elsif definition.field_type = 'multi_select' and new.multi_value is null then
    raise check_violation using message = 'Expected multiple custom field value';
  elsif definition.field_type = 'historical_date' and new.date_year is null then
    raise check_violation using message = 'Expected historical date custom field value';
  elsif definition.field_type = 'entity_reference' and new.reference_entity_id is null then
    raise check_violation using message = 'Expected entity reference custom field value';
  end if;
  if definition.field_type = 'single_select' and not (new.text_value = any(definition.options)) then
    raise check_violation using message = 'Unknown custom field option';
  end if;
  if definition.field_type = 'multi_select' and exists (
    select 1 from unnest(new.multi_value) selected where not (selected = any(definition.options))
  ) then raise check_violation using message = 'Unknown custom field option'; end if;
  if definition.field_type = 'url' and new.text_value !~* '^https?://' then
    raise check_violation using message = 'Unsafe custom field URL';
  end if;
  if definition.field_type = 'historical_date' and not public.is_valid_historical_date(new.date_year, new.date_month, new.date_day) then
    raise check_violation using message = 'Invalid historical date';
  end if;
  if new.reference_entity_type = 'timeline_item' and not exists (
    select 1 from public.timeline_items where project_id = new.project_id and id = new.reference_entity_id
  ) then raise foreign_key_violation using message = 'Referenced timeline item not found'; end if;
  if new.reference_entity_type = 'timeline_event' and not exists (
    select 1 from public.timeline_events where project_id = new.project_id and id = new.reference_entity_id
  ) then raise foreign_key_violation using message = 'Referenced timeline event not found'; end if;
  return new;
end $$;

revoke all on function public.validate_custom_field_value() from public;
grant execute on function public.validate_custom_field_value() to authenticated, service_role;
create trigger custom_field_values_validate before insert or update on public.custom_field_values
for each row execute function public.validate_custom_field_value();

create function public.cleanup_custom_field_values()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.custom_field_values
  where project_id = old.project_id
    and entity_type = case tg_table_name when 'timeline_items' then 'timeline_item' else 'timeline_event' end
    and entity_id = old.id;
  return old;
end $$;
revoke all on function public.cleanup_custom_field_values() from public;
grant execute on function public.cleanup_custom_field_values() to authenticated, service_role;
create trigger timeline_items_cleanup_custom_fields after delete on public.timeline_items
for each row execute function public.cleanup_custom_field_values();
create trigger timeline_events_cleanup_custom_fields after delete on public.timeline_events
for each row execute function public.cleanup_custom_field_values();

create function public.merge_tags(p_project_id uuid, p_source_tag_id uuid, p_target_tag_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_source_tag_id = p_target_tag_id then raise check_violation using message = 'Tags must differ'; end if;
  insert into public.timeline_item_tags (project_id, timeline_item_id, tag_id)
  select project_id, timeline_item_id, p_target_tag_id from public.timeline_item_tags
  where project_id = p_project_id and tag_id = p_source_tag_id on conflict do nothing;
  insert into public.timeline_event_tags (project_id, timeline_event_id, tag_id)
  select project_id, timeline_event_id, p_target_tag_id from public.timeline_event_tags
  where project_id = p_project_id and tag_id = p_source_tag_id on conflict do nothing;
  delete from public.tags where project_id = p_project_id and id = p_source_tag_id;
end $$;
revoke all on function public.merge_tags(uuid, uuid, uuid) from public;
grant execute on function public.merge_tags(uuid, uuid, uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['tags','event_types','timeline_item_tags','timeline_event_tags','custom_field_definitions','custom_field_values'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy "Permitted users can select %1$s" on public.%1$I for select to authenticated using (exists (select 1 from public.projects where projects.id = %1$I.project_id and (projects.owner_id = (select auth.uid()) or projects.visibility = ''public'')))', table_name);
    execute format('create policy "Anonymous users can select public %1$s" on public.%1$I for select to anon using (exists (select 1 from public.projects where projects.id = %1$I.project_id and projects.visibility = ''public''))', table_name);
    execute format('create policy "Owners can insert %1$s" on public.%1$I for insert to authenticated with check (exists (select 1 from public.projects where projects.id = %1$I.project_id and projects.owner_id = (select auth.uid())))', table_name);
    execute format('create policy "Owners can update %1$s" on public.%1$I for update to authenticated using (exists (select 1 from public.projects where projects.id = %1$I.project_id and projects.owner_id = (select auth.uid()))) with check (exists (select 1 from public.projects where projects.id = %1$I.project_id and projects.owner_id = (select auth.uid())))', table_name);
    execute format('create policy "Owners can delete %1$s" on public.%1$I for delete to authenticated using (exists (select 1 from public.projects where projects.id = %1$I.project_id and projects.owner_id = (select auth.uid())))', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select on table public.%I to anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

alter function public.import_project_data(uuid, text, jsonb)
rename to import_project_data_v3;
revoke all on function public.import_project_data_v3(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_project_data_v3(uuid, text, jsonb) to authenticated;

create function public.import_project_data(p_target_project_id uuid, p_mode text, p_payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  marked_payload jsonb := p_payload;
  destination_id uuid;
  source_row jsonb;
  value_row jsonb;
  source_id text;
  mapped_id uuid;
  mapped_entity_id uuid;
  mapped_field_id uuid;
  mapped_target_id uuid;
  item_map jsonb := '{}'::jsonb;
  event_map jsonb := '{}'::jsonb;
  tag_map jsonb := '{}'::jsonb;
  event_type_map jsonb := '{}'::jsonb;
  field_map jsonb := '{}'::jsonb;
  marker text;
begin
  marked_payload := jsonb_set(marked_payload, '{timelineItems}', coalesce((
    select jsonb_agg(jsonb_set(item.value, '{aliases}', coalesce(item.value->'aliases', '[]'::jsonb) || jsonb_build_array('__timeline_editor_l9_item:' || (item.value->>'id'))))
    from jsonb_array_elements(coalesce(p_payload->'timelineItems', '[]'::jsonb)) item(value)
  ), '[]'::jsonb));
  marked_payload := jsonb_set(marked_payload, '{timelineEvents}', coalesce((
    select jsonb_agg(jsonb_set(event.value, '{aliases}', coalesce(event.value->'aliases', '[]'::jsonb) || jsonb_build_array('__timeline_editor_l9_event:' || (event.value->>'id'))))
    from jsonb_array_elements(coalesce(p_payload->'timelineEvents', '[]'::jsonb)) event(value)
  ), '[]'::jsonb));

  destination_id := public.import_project_data_v3(p_target_project_id, p_mode, marked_payload);

  if p_mode = 'overwrite' then
    delete from public.custom_field_definitions where project_id = destination_id;
    delete from public.event_types where project_id = destination_id;
    delete from public.tags where project_id = destination_id;
  end if;

  select coalesce(jsonb_object_agg(substring(alias from length('__timeline_editor_l9_item:') + 1), item.id::text), '{}'::jsonb) into item_map
  from public.timeline_items item cross join lateral unnest(item.aliases) alias
  where item.project_id = destination_id and alias like '__timeline_editor_l9_item:%';
  select coalesce(jsonb_object_agg(substring(alias from length('__timeline_editor_l9_event:') + 1), event.id::text), '{}'::jsonb) into event_map
  from public.timeline_events event cross join lateral unnest(event.aliases) alias
  where event.project_id = destination_id and alias like '__timeline_editor_l9_event:%';
  update public.timeline_items set aliases = array(select alias from unnest(aliases) alias where alias not like '__timeline_editor_l9_item:%') where project_id = destination_id;
  update public.timeline_events set aliases = array(select alias from unnest(aliases) alias where alias not like '__timeline_editor_l9_event:%') where project_id = destination_id;

  for source_row in select value from jsonb_array_elements(coalesce(p_payload->'tags', '[]'::jsonb)) loop
    insert into public.tags (project_id, name, color, description) values (destination_id, source_row->>'name', source_row->>'color', nullif(source_row->>'description', ''))
    on conflict (project_id, normalized_name) do update set name = excluded.name, color = excluded.color, description = excluded.description
    returning id into mapped_id;
    tag_map := tag_map || jsonb_build_object(source_row->>'id', mapped_id::text);
  end loop;

  for source_row in select value from jsonb_array_elements(coalesce(p_payload->'eventTypes', '[]'::jsonb)) loop
    insert into public.event_types (project_id, name, color, marker_shape, description, sort_order) values (destination_id, source_row->>'name', source_row->>'color', source_row->>'markerShape', nullif(source_row->>'description', ''), coalesce((source_row->>'sortOrder')::integer, 0))
    on conflict (project_id, normalized_name) do update set name = excluded.name, color = excluded.color, marker_shape = excluded.marker_shape, description = excluded.description
    returning id into mapped_id;
    event_type_map := event_type_map || jsonb_build_object(source_row->>'id', mapped_id::text);
  end loop;

  for source_row in select value from jsonb_array_elements(coalesce(p_payload->'timelineEvents', '[]'::jsonb)) loop
    mapped_id := nullif(event_map->>(source_row->>'id'), '')::uuid;
    if mapped_id is not null then update public.timeline_events set event_type_id = nullif(event_type_map->>(source_row->>'eventTypeId'), '')::uuid where project_id = destination_id and id = mapped_id; end if;
  end loop;

  for source_row in select value from jsonb_array_elements(coalesce(p_payload->'customFields', '[]'::jsonb)) loop
    mapped_target_id := null;
    if source_row->>'scope' = 'type' and source_row->>'entityType' = 'timeline_item' then
      select destination_type.id into mapped_target_id from public.timeline_item_types destination_type
      where destination_type.project_id = destination_id and destination_type.normalized_name = (
        select lower(regexp_replace(btrim(source_type.value->>'name'), '\s+', ' ', 'g')) from jsonb_array_elements(coalesce(p_payload->'itemTypes', '[]'::jsonb)) source_type(value) where source_type.value->>'id' = source_row->>'targetTypeId' limit 1
      );
    elsif source_row->>'scope' = 'type' then mapped_target_id := nullif(event_type_map->>(source_row->>'targetTypeId'), '')::uuid; end if;
    insert into public.custom_field_definitions (project_id, entity_type, scope, target_type_id, name, field_type, is_required, options, description, sort_order)
    values (destination_id, source_row->>'entityType', source_row->>'scope', mapped_target_id, source_row->>'name', source_row->>'fieldType', coalesce((source_row->>'isRequired')::boolean, false), array(select jsonb_array_elements_text(coalesce(source_row->'options', '[]'::jsonb))), nullif(source_row->>'description', ''), coalesce((source_row->>'sortOrder')::integer, 0))
    on conflict (project_id, entity_type, target_type_id, normalized_name) do update set field_type = excluded.field_type, is_required = excluded.is_required, options = excluded.options, description = excluded.description
    returning id into mapped_id;
    field_map := field_map || jsonb_build_object(source_row->>'id', mapped_id::text);
  end loop;

  for source_row in
    select value || jsonb_build_object('_entityType', 'timeline_item') from jsonb_array_elements(coalesce(p_payload->'timelineItems', '[]'::jsonb))
    union all
    select value || jsonb_build_object('_entityType', 'timeline_event') from jsonb_array_elements(coalesce(p_payload->'timelineEvents', '[]'::jsonb))
  loop
    mapped_entity_id := case source_row->>'_entityType' when 'timeline_item' then nullif(item_map->>(source_row->>'id'), '')::uuid else nullif(event_map->>(source_row->>'id'), '')::uuid end;
    if mapped_entity_id is null then continue; end if;
    foreach source_id in array array(select jsonb_array_elements_text(coalesce(source_row->'tagIds', '[]'::jsonb))) loop
      mapped_id := nullif(tag_map->>source_id, '')::uuid;
      if mapped_id is not null and source_row->>'_entityType' = 'timeline_item' then insert into public.timeline_item_tags (project_id, timeline_item_id, tag_id) values (destination_id, mapped_entity_id, mapped_id) on conflict do nothing;
      elsif mapped_id is not null then insert into public.timeline_event_tags (project_id, timeline_event_id, tag_id) values (destination_id, mapped_entity_id, mapped_id) on conflict do nothing; end if;
    end loop;
    for value_row in select value from jsonb_array_elements(coalesce(source_row->'customFields', '[]'::jsonb)) loop
      mapped_field_id := nullif(field_map->>(value_row->>'fieldId'), '')::uuid;
      if mapped_field_id is null then continue; end if;
      if value_row->'value' ? 'entityId' then
        mapped_target_id := case value_row#>>'{value,entityType}' when 'timeline_item' then nullif(item_map->>(value_row#>>'{value,entityId}'), '')::uuid else nullif(event_map->>(value_row#>>'{value,entityId}'), '')::uuid end;
      else mapped_target_id := null; end if;
      insert into public.custom_field_values (project_id, field_id, entity_type, entity_id, text_value, number_value, boolean_value, multi_value, date_era, date_precision, date_year, date_month, date_day, date_original_text, date_calendar, reference_entity_type, reference_entity_id)
      select destination_id, mapped_field_id, source_row->>'_entityType', mapped_entity_id,
        case when definition.field_type in ('text','multiline','single_select','url') then value_row#>>'{value}' end,
        nullif(case when definition.field_type = 'number' then value_row#>>'{value}' else '' end, '')::numeric,
        nullif(case when definition.field_type = 'boolean' then value_row#>>'{value}' else '' end, '')::boolean,
        case when definition.field_type = 'multi_select' then array(select jsonb_array_elements_text(value_row->'value')) end,
        case when definition.field_type = 'historical_date' then coalesce(value_row#>>'{value,era}', 'ce') end,
        case when definition.field_type = 'historical_date' then coalesce(value_row#>>'{value,precision}', 'year') end,
        nullif(case when definition.field_type = 'historical_date' then value_row#>>'{value,year}' else '' end, '')::integer,
        nullif(case when definition.field_type = 'historical_date' then value_row#>>'{value,month}' else '' end, '')::integer,
        nullif(case when definition.field_type = 'historical_date' then value_row#>>'{value,day}' else '' end, '')::integer,
        case when definition.field_type = 'historical_date' then nullif(value_row#>>'{value,originalText}', '') end,
        case when definition.field_type = 'historical_date' then coalesce(value_row#>>'{value,calendar}', 'proleptic_gregorian') end,
        case when definition.field_type = 'entity_reference' then value_row#>>'{value,entityType}' end,
        case when definition.field_type = 'entity_reference' then mapped_target_id end
      from public.custom_field_definitions definition where definition.project_id = destination_id and definition.id = mapped_field_id;
    end loop;
  end loop;
  return destination_id;
end $$;

revoke all on function public.import_project_data(uuid, text, jsonb) from public;
grant execute on function public.import_project_data(uuid, text, jsonb) to authenticated;

comment on table public.tags is 'Project tag master shared by timeline items and events; names are not duplicated on entities.';
comment on table public.event_types is 'Project event type master with accessible marker shape and color styling.';
comment on table public.custom_field_values is 'Sparse typed custom values. Empty values are omitted rather than stored.';
