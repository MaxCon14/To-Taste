create table public.cook_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9_]{2,23}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280)
);

create table public.cook_follows (
  follower_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cook_id uuid not null references public.cook_profiles(user_id) on delete cascade,
  primary key (follower_id, cook_id),
  check (follower_id <> cook_id)
);

create index cook_follows_cook_idx on public.cook_follows (cook_id);
create index community_recipes_cook_recent_idx on public.community_recipes (user_id, published_at desc, id);
alter table public.cook_profiles enable row level security;
alter table public.cook_follows enable row level security;
revoke all on public.cook_profiles, public.cook_follows from anon, authenticated;
grant select on public.cook_profiles to anon, authenticated;
grant insert (handle, name, bio), update (handle, name, bio) on public.cook_profiles to authenticated;
grant select, delete on public.cook_follows to authenticated;
grant insert (cook_id) on public.cook_follows to authenticated;

create policy "Read public cook profiles" on public.cook_profiles for select using (true);
create policy "Create own cook profile" on public.cook_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false));
create policy "Edit own cook profile" on public.cook_profiles for update to authenticated
  using ((select auth.uid()) = user_id and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false))
  with check ((select auth.uid()) = user_id);
create policy "Read own follows" on public.cook_follows for select to authenticated
  using ((select auth.uid()) = follower_id);
create policy "Follow as yourself" on public.cook_follows for insert to authenticated
  with check ((select auth.uid()) = follower_id and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false));
create policy "Remove own follows" on public.cook_follows for delete to authenticated
  using ((select auth.uid()) = follower_id);

create function public.search_cooks(term text default '')
returns setof public.cook_profiles
language sql stable security invoker set search_path = ''
as $$
  select * from public.cook_profiles
  where strpos(lower(handle), lower(ltrim(left(term, 60), '@'))) > 0
    or strpos(lower(name), lower(left(term, 60))) > 0
    or term = ''
  order by (handle = lower(ltrim(term, '@'))) desc, handle
  limit 30
$$;
revoke execute on function public.search_cooks(text) from public;
grant execute on function public.search_cooks(text) to authenticated;

create function public.followed_recipes()
returns setof public.community_recipes
language sql stable security invoker set search_path = ''
as $$
  select recipes.* from public.community_recipes as recipes
  join public.cook_follows as follows on follows.cook_id = recipes.user_id
  where follows.follower_id = (select auth.uid())
  order by recipes.published_at desc, recipes.id
  limit 100
$$;
revoke execute on function public.followed_recipes() from public;
grant execute on function public.followed_recipes() to authenticated;
