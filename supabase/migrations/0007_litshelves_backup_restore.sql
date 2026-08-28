-- Extend the version 1 Pagewise backup RPC with LitShelves inventory while
-- keeping backups created before LitShelves backward compatible.
create or replace function public.pagewise_upsert_backup_rows(p_table regclass, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  table_name text := p_table::text;
  conflict_columns text[];
  column_list text;
  update_list text;
  conflict_list text;
  join_predicate text;
  sanitized_rows jsonb;
  foreign_collision boolean;
  affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  conflict_columns := case table_name
    when 'books' then array['id'] when 'reading_attempts' then array['id']
    when 'lists' then array['id'] when 'list_books' then array['list_id','book_id']
    when 'reading_logs' then array['id'] when 'quotes' then array['id']
    when 'reading_goals' then array['user_id','year'] when 'streak_freezes' then array['user_id','frozen_date']
    when 'user_settings' then array['user_id'] when 'inventory_items' then array['id']
    else null end;
  if conflict_columns is null then raise exception 'Unsupported backup table'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Backup collection must be an array'; end if;
  if jsonb_array_length(p_rows) = 0 then return 0; end if;

  select jsonb_agg(value || jsonb_build_object('user_id', auth.uid())) into sanitized_rows
  from jsonb_array_elements(p_rows);
  select string_agg(format('%I', attname), ', ' order by attnum),
         string_agg(format('%1$I = excluded.%1$I', attname), ', ' order by attnum)
           filter (where not (attname = any(conflict_columns)) and attname <> 'user_id')
    into column_list, update_list
    from pg_attribute
    where attrelid = p_table and attnum > 0 and not attisdropped and attgenerated = '';
  select string_agg(format('%I', value), ', '),
         string_agg(format('t.%1$I = r.%1$I', value), ' and ')
    into conflict_list, join_predicate from unnest(conflict_columns) value;

  execute format('select exists(select 1 from %1$s t join jsonb_populate_recordset(null::%1$s, $1) r on %2$s where t.user_id <> auth.uid())', table_name, join_predicate)
    into foreign_collision using sanitized_rows;
  if foreign_collision then raise exception 'Backup contains an identifier owned by another account'; end if;

  execute format('insert into %1$s (%2$s) select %2$s from jsonb_populate_recordset(null::%1$s, $1) on conflict (%3$s) do update set %4$s where %1$s.user_id = auth.uid()', table_name, column_list, conflict_list, update_list)
    using sanitized_rows;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.pagewise_upsert_backup_rows(regclass, jsonb) from public, anon, authenticated;

create or replace function public.restore_pagewise_backup(p_backup jsonb, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb := p_backup -> 'data';
  settings_rows jsonb;
  books_rows jsonb;
  inventory_rows jsonb := coalesce(payload->'inventoryItems', '[]'::jsonb);
  restored integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if (p_backup ->> 'format') is distinct from 'pagewise-backup' or (p_backup ->> 'version') is distinct from '1' then raise exception 'Unsupported Pagewise backup'; end if;
  if p_mode not in ('merge','replace') then raise exception 'Import mode must be merge or replace'; end if;
  if jsonb_typeof(payload) <> 'object' then raise exception 'Backup data is missing'; end if;
  if jsonb_typeof(inventory_rows) <> 'array' then raise exception 'Inventory backup collection must be an array'; end if;

  if p_mode = 'replace' then
    delete from public.inventory_items where user_id = auth.uid();
    delete from public.lists where user_id = auth.uid();
    delete from public.books where user_id = auth.uid();
    delete from public.reading_goals where user_id = auth.uid();
    delete from public.streak_freezes where user_id = auth.uid();
  end if;

  select coalesce(jsonb_agg(value - 'active_attempt_id'), '[]'::jsonb) into books_rows
  from jsonb_array_elements(coalesce(payload->'books', '[]'::jsonb));
  restored := restored + public.pagewise_upsert_backup_rows('public.books', books_rows);

  if exists (
    select 1 from jsonb_to_recordset(coalesce(payload->'readingAttempts', '[]'::jsonb)) as source(book_id uuid)
    where not exists (select 1 from public.books b where b.id = source.book_id and b.user_id = auth.uid())
  ) then raise exception 'A reading attempt references a book outside this account'; end if;
  restored := restored + public.pagewise_upsert_backup_rows('public.reading_attempts', coalesce(payload->'readingAttempts', '[]'::jsonb));

  update public.books b set active_attempt_id = source.active_attempt_id
  from jsonb_to_recordset(coalesce(payload->'books', '[]'::jsonb)) as source(id uuid, active_attempt_id uuid)
  where b.id = source.id and b.user_id = auth.uid()
    and (source.active_attempt_id is null or exists(select 1 from public.reading_attempts a where a.id = source.active_attempt_id and a.user_id = auth.uid() and a.book_id = b.id));

  restored := restored + public.pagewise_upsert_backup_rows('public.lists', coalesce(payload->'lists', '[]'::jsonb));
  restored := restored + public.pagewise_upsert_backup_rows('public.list_books', coalesce(payload->'listBooks', '[]'::jsonb));

  if exists (
    select 1 from jsonb_to_recordset(coalesce(payload->'readingLogs', '[]'::jsonb)) as source(book_id uuid, attempt_id uuid)
    where not exists (select 1 from public.books b where b.id = source.book_id and b.user_id = auth.uid())
       or (source.attempt_id is not null and not exists (select 1 from public.reading_attempts a where a.id = source.attempt_id and a.book_id = source.book_id and a.user_id = auth.uid()))
  ) then raise exception 'A reading log references history outside this account'; end if;
  restored := restored + public.pagewise_upsert_backup_rows('public.reading_logs', coalesce(payload->'readingLogs', '[]'::jsonb));

  if exists (
    select 1 from jsonb_to_recordset(coalesce(payload->'quotes', '[]'::jsonb)) as source(book_id uuid)
    where not exists (select 1 from public.books b where b.id = source.book_id and b.user_id = auth.uid())
  ) then raise exception 'A quote references a book outside this account'; end if;
  restored := restored + public.pagewise_upsert_backup_rows('public.quotes', coalesce(payload->'quotes', '[]'::jsonb));

  if exists (
    select 1 from jsonb_to_recordset(inventory_rows) as source(pagewise_book_id uuid)
    where source.pagewise_book_id is not null
      and not exists (select 1 from public.books b where b.id = source.pagewise_book_id and b.user_id = auth.uid())
  ) then raise exception 'An inventory item references a Pagewise book outside this account'; end if;
  restored := restored + public.pagewise_upsert_backup_rows('public.inventory_items', inventory_rows);

  restored := restored + public.pagewise_upsert_backup_rows('public.reading_goals', coalesce(payload->'readingGoals', '[]'::jsonb));
  restored := restored + public.pagewise_upsert_backup_rows('public.streak_freezes', coalesce(payload->'streakFreezes', '[]'::jsonb));
  settings_rows := jsonb_build_array(coalesce(payload->'userSettings', '{}'::jsonb));
  restored := restored + public.pagewise_upsert_backup_rows('public.user_settings', settings_rows);

  return jsonb_build_object('mode', p_mode, 'records', restored);
end;
$$;

revoke all on function public.restore_pagewise_backup(jsonb, text) from public, anon;
grant execute on function public.restore_pagewise_backup(jsonb, text) to authenticated;
