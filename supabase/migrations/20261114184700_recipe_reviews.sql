create table public.recipe_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  community_id uuid references public.community_recipes(id) on delete cascade,
  featured_id text check (featured_id in ('tomato-pasta', 'lemon-chicken', 'blueberry-pancakes', 'lemon-chickpeas', 'lemon-salmon')),
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(community_id, featured_id) = 1),
  unique (user_id, community_id),
  unique (user_id, featured_id)
);

create index recipe_reviews_community_recent on public.recipe_reviews (community_id, created_at desc);
create index recipe_reviews_featured_recent on public.recipe_reviews (featured_id, created_at desc);

alter table public.recipe_reviews enable row level security;
revoke all on public.recipe_reviews from anon, authenticated;
grant select on public.recipe_reviews to authenticated;
grant insert (community_id, featured_id, rating, body), update (rating, body) on public.recipe_reviews to authenticated;

create policy "Signed-in users read recipe reviews" on public.recipe_reviews for select to authenticated
  using (not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false));
create policy "Users create their own review" on public.recipe_reviews for insert to authenticated
  with check ((select auth.uid()) = user_id and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false));
create policy "Users edit their own review" on public.recipe_reviews for update to authenticated
  using ((select auth.uid()) = user_id and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false))
  with check ((select auth.uid()) = user_id);

create function public.recipe_review_summary(community uuid default null, featured text default null)
returns table (average numeric, total bigint)
language sql stable security invoker set search_path = ''
as $$
  select round(avg(rating), 1), count(*)
  from public.recipe_reviews
  where community_id = community or featured_id = featured
$$;
revoke execute on function public.recipe_review_summary(uuid, text) from public, anon;
grant execute on function public.recipe_review_summary(uuid, text) to authenticated;
