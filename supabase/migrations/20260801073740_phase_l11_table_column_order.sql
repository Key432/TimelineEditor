alter table public.table_view_preferences
add column column_order jsonb not null default '[]'::jsonb
check (jsonb_typeof(column_order) = 'array');

update public.table_view_preferences
set column_order = visible_columns;

comment on column public.table_view_preferences.column_order is
'Stable order of all built-in and custom table columns, including hidden columns.';
