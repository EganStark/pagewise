create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  author text,
  cover_image_url text,
  cover_storage_path text,
  cover_source text check (cover_source in ('upload','url','open_library','placeholder')),
  open_library_work_key text,
  open_library_edition_key text,
  genre text,
  total_pages integer check (total_pages is null or total_pages > 0),
  publication_year integer check (publication_year is null or publication_year between 1000 and 2200),
  description text,
  isbn text,
  status text not null default 'want_to_read' check (status in ('want_to_read','reading','completed','on_hold','dropped')),
  is_favorite boolean not null default false,
  current_page integer not null default 0 check (current_page >= 0),
  active_attempt_id uuid,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_pages is null or current_page <= total_pages)
);

create table public.reading_attempts (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  started_at date,
  completed_at date,
  rating_numeric numeric(2,1) check (rating_numeric is null or rating_numeric in (0.5,1,1.5,2,2.5,3,3.5,4,4.5,5)),
  rating_tag text check (rating_tag is null or rating_tag in ('Masterpiece','Excellent','Very Good','Good','Average','Below Average','Bad','Very Bad')),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, attempt_number),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

alter table public.books add constraint books_active_attempt_fk foreign key (active_attempt_id) references public.reading_attempts(id) on delete set null;

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_books (
  list_id uuid not null references public.lists(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  added_at timestamptz not null default now(),
  primary key (list_id, book_id)
);

create table public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  attempt_id uuid references public.reading_attempts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  start_page integer check (start_page is null or start_page >= 0),
  end_page integer check (end_page is null or end_page >= 0),
  pages_read integer not null check (pages_read >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_page is null or end_page is null or end_page >= start_page)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer check (page_number is null or page_number >= 0),
  quote_text text not null check (length(trim(quote_text)) > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  target_books integer not null check (target_books > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  timezone text not null default 'UTC',
  streak_freeze_available boolean not null default true,
  streak_freeze_last_reset date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  frozen_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, frozen_date)
);

create index books_user_status_idx on public.books(user_id, status);
create index books_user_updated_idx on public.books(user_id, updated_at desc);
create index books_tags_idx on public.books using gin(tags);
create index reading_attempts_user_completed_idx on public.reading_attempts(user_id, completed_at);
create index reading_logs_user_date_idx on public.reading_logs(user_id, log_date);
create index reading_logs_book_date_idx on public.reading_logs(book_id, log_date);

create or replace function public.log_reading(
  p_book_id uuid,
  p_log_date date,
  p_start_page integer,
  p_end_page integer,
  p_note text default null
) returns uuid language plpgsql security invoker as $$
declare
  target_book public.books%rowtype;
  new_log_id uuid;
begin
  select * into target_book from public.books where id = p_book_id and user_id = auth.uid() for update;
  if not found then raise exception 'Book not found'; end if;
  if target_book.active_attempt_id is null or target_book.status <> 'reading' then raise exception 'Start or resume this book before logging pages'; end if;
  if p_start_page is null or p_end_page is null or p_end_page <= p_start_page then raise exception 'End page must be greater than start page'; end if;
  if target_book.total_pages is not null and p_end_page > target_book.total_pages then raise exception 'End page exceeds the book page count'; end if;
  insert into public.reading_logs (book_id, attempt_id, user_id, log_date, start_page, end_page, pages_read, note)
  values (p_book_id, target_book.active_attempt_id, auth.uid(), p_log_date, p_start_page, p_end_page, p_end_page - p_start_page, nullif(trim(p_note), ''))
  returning id into new_log_id;
  if p_end_page > target_book.current_page then update public.books set current_page = p_end_page where id = p_book_id; end if;
  return new_log_id;
end;
$$;
create index quotes_book_created_idx on public.quotes(book_id, created_at);
create index list_books_user_book_idx on public.list_books(user_id, book_id);

do $$
declare table_name text;
begin
  foreach table_name in array array['books','reading_attempts','lists','reading_logs','quotes','reading_goals','user_settings'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.books enable row level security;
alter table public.reading_attempts enable row level security;
alter table public.lists enable row level security;
alter table public.list_books enable row level security;
alter table public.reading_logs enable row level security;
alter table public.quotes enable row level security;
alter table public.reading_goals enable row level security;
alter table public.user_settings enable row level security;
alter table public.streak_freezes enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['books','reading_attempts','lists','list_books','reading_logs','quotes','reading_goals','user_settings','streak_freezes'] loop
    execute format('create policy %I_select_own on public.%I for select using (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy %I_insert_own on public.%I for insert with check (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy %I_update_own on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy %I_delete_own on public.%I for delete using (auth.uid() = user_id)', table_name, table_name);
  end loop;
end $$;

create or replace function public.validate_list_book_ownership()
returns trigger language plpgsql security invoker as $$
begin
  if not exists (select 1 from public.lists where id = new.list_id and user_id = new.user_id)
     or not exists (select 1 from public.books where id = new.book_id and user_id = new.user_id) then
    raise exception 'List and book must belong to the same user';
  end if;
  return new;
end;
$$;

create trigger list_books_validate_ownership before insert or update on public.list_books for each row execute function public.validate_list_book_ownership();

create or replace function public.start_reading_attempt(p_book_id uuid, p_started_at date default current_date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  target_book public.books%rowtype;
  target_attempt public.reading_attempts%rowtype;
  next_number integer;
begin
  select * into target_book from public.books
  where id = p_book_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Book not found'; end if;

  if target_book.active_attempt_id is not null then
    select * into target_attempt from public.reading_attempts
    where id = target_book.active_attempt_id and user_id = auth.uid() and completed_at is null;
  end if;

  if target_attempt.id is null then
    select coalesce(max(attempt_number), 0) + 1 into next_number
    from public.reading_attempts where book_id = p_book_id;
    insert into public.reading_attempts (book_id, user_id, attempt_number, started_at)
    values (p_book_id, auth.uid(), next_number, p_started_at)
    returning * into target_attempt;
    update public.books set status = 'reading', current_page = 0, active_attempt_id = target_attempt.id
    where id = p_book_id;
  else
    update public.books set status = 'reading' where id = p_book_id;
  end if;
  return target_attempt.id;
end;
$$;

create or replace function public.pause_reading_attempt(p_book_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare target_book public.books%rowtype;
begin
  if p_status not in ('on_hold', 'dropped') then raise exception 'Invalid paused status'; end if;
  select * into target_book from public.books
  where id = p_book_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Book not found'; end if;
  if target_book.active_attempt_id is null then raise exception 'No active reading attempt'; end if;
  update public.books set status = p_status where id = p_book_id;
end;
$$;

create or replace function public.finish_reading_attempt(
  p_book_id uuid,
  p_completed_at date default current_date,
  p_started_at date default null,
  p_rating_numeric numeric default null,
  p_rating_tag text default null,
  p_review text default null
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  target_book public.books%rowtype;
  target_attempt public.reading_attempts%rowtype;
  next_number integer;
begin
  select * into target_book from public.books
  where id = p_book_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'Book not found'; end if;

  if target_book.active_attempt_id is not null then
    select * into target_attempt from public.reading_attempts
    where id = target_book.active_attempt_id and user_id = auth.uid() and completed_at is null;
  end if;
  if target_attempt.id is null then
    select coalesce(max(attempt_number), 0) + 1 into next_number
    from public.reading_attempts where book_id = p_book_id;
    insert into public.reading_attempts (book_id, user_id, attempt_number, started_at, completed_at, rating_numeric, rating_tag, review)
    values (p_book_id, auth.uid(), next_number, coalesce(p_started_at, p_completed_at), p_completed_at, p_rating_numeric, p_rating_tag, p_review)
    returning * into target_attempt;
  else
    update public.reading_attempts set
      started_at = coalesce(p_started_at, started_at),
      completed_at = p_completed_at,
      rating_numeric = p_rating_numeric,
      rating_tag = p_rating_tag,
      review = p_review
    where id = target_attempt.id returning * into target_attempt;
  end if;
  update public.books set status = 'completed', current_page = coalesce(total_pages, current_page), active_attempt_id = null
  where id = p_book_id;
  return target_attempt.id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings (user_id, timezone)
  values (new.id, 'UTC')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create policy book_covers_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy book_covers_update_own on storage.objects for update to authenticated
using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy book_covers_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
