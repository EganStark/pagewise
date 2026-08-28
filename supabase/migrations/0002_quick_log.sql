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

  if p_end_page > target_book.current_page then
    update public.books set current_page = p_end_page where id = p_book_id;
  end if;
  return new_log_id;
end;
$$;
