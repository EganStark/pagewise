alter table public.user_settings
  add column if not exists display_name text,
  add column if not exists birth_year integer,
  add column if not exists bio text,
  add column if not exists avatar_path text;

alter table public.user_settings
  add constraint user_settings_display_name_length
    check (display_name is null or char_length(display_name) <= 80),
  add constraint user_settings_birth_year_range
    check (birth_year is null or birth_year between 1900 and 2100),
  add constraint user_settings_bio_length
    check (bio is null or char_length(bio) <= 280),
  add constraint user_settings_avatar_path_length
    check (avatar_path is null or char_length(avatar_path) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy profile_images_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy profile_images_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy profile_images_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy profile_images_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
