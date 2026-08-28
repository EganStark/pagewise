alter table public.list_books add column if not exists position integer not null default 0 check (position >= 0);
create index if not exists list_books_list_position_idx on public.list_books(list_id, position);

with ranked as (
  select list_id, book_id, row_number() over (partition by list_id order by added_at, book_id) - 1 as next_position
  from public.list_books
)
update public.list_books lb set position = ranked.next_position
from ranked where lb.list_id = ranked.list_id and lb.book_id = ranked.book_id;
