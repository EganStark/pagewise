create or replace function public.maintain_streak_freeze()
returns table (freeze_available boolean, freeze_used_date date)
language plpgsql security invoker as $$
declare
  settings_row public.user_settings%rowtype;
  used_date date := null;
  local_today date;
begin
  select * into settings_row from public.user_settings where user_id = auth.uid() for update;
  if not found then
    insert into public.user_settings (user_id, timezone, streak_freeze_available, streak_freeze_last_reset)
    values (auth.uid(), 'UTC', true, date_trunc('month', current_date)::date)
    returning * into settings_row;
  end if;
  local_today := timezone(settings_row.timezone, now())::date;

  if settings_row.streak_freeze_available
    and not exists (select 1 from public.reading_logs where user_id = auth.uid() and log_date = local_today - 1)
    and exists (select 1 from public.reading_logs where user_id = auth.uid() and log_date = local_today - 2)
  then
    insert into public.streak_freezes (user_id, frozen_date)
    values (auth.uid(), local_today - 1)
    on conflict (user_id, frozen_date) do nothing;
    if found then
      used_date := local_today - 1;
      update public.user_settings set streak_freeze_available = false where user_id = auth.uid();
      settings_row.streak_freeze_available := false;
    end if;
  end if;

  if settings_row.streak_freeze_last_reset is null
    or settings_row.streak_freeze_last_reset < date_trunc('month', local_today)::date
  then
    update public.user_settings
    set streak_freeze_available = true, streak_freeze_last_reset = date_trunc('month', local_today)::date
    where user_id = auth.uid();
    settings_row.streak_freeze_available := true;
  end if;

  return query select settings_row.streak_freeze_available, used_date;
end;
$$;
