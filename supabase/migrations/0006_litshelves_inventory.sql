create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pagewise_book_id uuid references public.books(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  author text,
  isbn text,
  publisher text,
  publication_year integer check (publication_year is null or publication_year between 1 and 2200),
  edition text,
  language text,
  genre text,
  format text,
  condition text check (condition is null or condition in ('new','like_new','good','fair','poor')),
  location text,
  shelf text,
  quantity integer not null default 1 check (quantity > 0),
  acquisition_date date,
  purchase_price numeric(12,2) check (purchase_price is null or purchase_price >= 0),
  currency text check (currency is null or length(currency) = 3),
  is_lent boolean not null default false,
  lent_to text,
  lent_at date,
  due_date date,
  notes text,
  cover_image_url text,
  cover_storage_path text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_lent or (lent_to is null and lent_at is null and due_date is null)),
  check (due_date is null or lent_at is null or due_date >= lent_at)
);

create index inventory_items_user_updated_idx on public.inventory_items(user_id, updated_at desc);
create index inventory_items_user_location_idx on public.inventory_items(user_id, location, shelf);
create index inventory_items_user_author_idx on public.inventory_items(user_id, author);
create index inventory_items_isbn_idx on public.inventory_items(user_id, isbn) where isbn is not null;
create index inventory_items_tags_idx on public.inventory_items using gin(tags);

create trigger inventory_items_set_updated_at before update on public.inventory_items
for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;
create policy inventory_items_select_own on public.inventory_items for select using (auth.uid() = user_id);
create policy inventory_items_insert_own on public.inventory_items for insert with check (
  auth.uid() = user_id and (
    pagewise_book_id is null or exists (
      select 1 from public.books where id = pagewise_book_id and user_id = auth.uid()
    )
  )
);
create policy inventory_items_update_own on public.inventory_items for update
using (auth.uid() = user_id) with check (
  auth.uid() = user_id and (
    pagewise_book_id is null or exists (
      select 1 from public.books where id = pagewise_book_id and user_id = auth.uid()
    )
  )
);
create policy inventory_items_delete_own on public.inventory_items for delete using (auth.uid() = user_id);
