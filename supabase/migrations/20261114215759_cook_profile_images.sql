alter table public.cook_profiles
  add column avatar_image text,
  add column banner_image text,
  add constraint cook_avatar_owned_path check (
    avatar_image is null or avatar_image ~ ('^' || user_id::text || '/avatar-[0-9a-f-]{36}\.jpg$')
  ),
  add constraint cook_banner_owned_path check (
    banner_image is null or banner_image ~ ('^' || user_id::text || '/banner-[0-9a-f-]{36}\.jpg$')
  );
grant insert (avatar_image, banner_image), update (avatar_image, banner_image) on public.cook_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cook-profile-images', 'cook-profile-images', true, 1500000, array['image/jpeg']);

create policy "Upload own profile images" on storage.objects for insert to authenticated
  with check (bucket_id = 'cook-profile-images'
    and name ~ ('^' || (select auth.uid())::text || '/(avatar|banner)-[0-9a-f-]{36}\.jpg$')
    and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "List own profile images" on storage.objects for select to authenticated
  using (bucket_id = 'cook-profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Remove own profile images" on storage.objects for delete to authenticated
  using (bucket_id = 'cook-profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
