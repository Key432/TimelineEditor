create table private.application_schema_versions (
  version integer primary key check (version > 0),
  name text not null unique,
  baseline_migration text not null,
  applied_at timestamptz not null default statement_timestamp()
);

alter table private.application_schema_versions enable row level security;

revoke all on table private.application_schema_versions from public, anon, authenticated;

insert into private.application_schema_versions (
  version,
  name,
  baseline_migration
) values (
  1,
  'level-up-baseline',
  '20260726112629_optimize_timeline_item_dates.sql'
);

comment on table private.application_schema_versions is
'Internal compatibility markers for application-level database schema migrations. Version 1 records the pre-L0 schema without rewriting existing project data.';
