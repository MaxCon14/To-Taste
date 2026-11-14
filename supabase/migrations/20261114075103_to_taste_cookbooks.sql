create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  diet text not null default 'any' check (diet in ('any','vegan','vegetarian','pescatarian'))
);

create table public.cookbook_recipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 160),
  recipe jsonb not null check (jsonb_typeof(recipe) = 'object' and octet_length(recipe::text) <= 100000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.community_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  recipe_id text not null,
  recipe jsonb not null check (jsonb_typeof(recipe) = 'object' and octet_length(recipe::text) <= 100000),
  options jsonb not null,
  published_at timestamptz not null default now(),
  unique (user_id, recipe_id),
  foreign key (user_id, recipe_id) references public.cookbook_recipes(user_id, id) on delete cascade
);

create index community_recipes_recent_idx on public.community_recipes (published_at desc);
create index cookbook_recipes_recent_idx on public.cookbook_recipes (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.cookbook_recipes enable row level security;
alter table public.community_recipes enable row level security;

revoke all on public.profiles, public.cookbook_recipes, public.community_recipes from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cookbook_recipes, public.community_recipes to authenticated;
grant select on public.community_recipes to anon;

create policy "Manage own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Manage own cookbook" on public.cookbook_recipes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Read published recipes" on public.community_recipes for select to anon, authenticated using (true);
create policy "Publish own recipes" on public.community_recipes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own publications" on public.community_recipes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Remove own publications" on public.community_recipes for delete to authenticated
  using ((select auth.uid()) = user_id);
