create table public.recipe_books (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null default auth.uid() references public.cook_profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  post_ids uuid[] not null check (cardinality(post_ids) between 1 and 30 and array_position(post_ids, null) is null),
  created_at timestamptz not null default now()
);
create index recipe_books_cook_recent_idx on public.recipe_books (cook_id, created_at desc);
alter table public.recipe_books enable row level security;
revoke all on public.recipe_books from anon, authenticated;
grant select, delete on public.recipe_books to authenticated;
grant insert (title, post_ids), update (title, post_ids) on public.recipe_books to authenticated;
create policy "Read published books" on public.recipe_books for select to authenticated using (true);
create policy "Create own books" on public.recipe_books for insert to authenticated
  with check ((select auth.uid()) = cook_id and not exists (
    select 1 from unnest(post_ids) as post(id) where not exists (
      select 1 from public.community_recipes as recipe where recipe.id = post.id and recipe.user_id = cook_id
    )
  ));
create policy "Edit own books" on public.recipe_books for update to authenticated
  using ((select auth.uid()) = cook_id)
  with check ((select auth.uid()) = cook_id and not exists (
    select 1 from unnest(post_ids) as post(id) where not exists (
      select 1 from public.community_recipes as recipe where recipe.id = post.id and recipe.user_id = cook_id
    )
  ));
create policy "Remove own books" on public.recipe_books for delete to authenticated using ((select auth.uid()) = cook_id);

create function public.search_recipe_books(term text)
returns setof public.recipe_books
language sql stable security invoker set search_path = ''
as $$
  select books.* from public.recipe_books as books
  join public.cook_profiles as cook on cook.user_id = books.cook_id
  where strpos(lower(books.title), lower(left(btrim(term), 80))) > 0
    or strpos(lower(cook.handle), lower(ltrim(left(btrim(term), 80), '@'))) > 0
    or strpos(lower(cook.name), lower(left(btrim(term), 80))) > 0
  order by books.created_at desc, books.id limit 30
$$;
revoke execute on function public.search_recipe_books(text) from public;
grant execute on function public.search_recipe_books(text) to authenticated;

create function public.search_recipe_posts(term text)
returns setof public.community_recipes
language sql stable security invoker set search_path = ''
as $$
  select posts.* from public.community_recipes as posts
  left join public.cook_profiles as cook on cook.user_id = posts.user_id
  where strpos(lower(posts.recipe->>'title'), lower(left(btrim(term), 80))) > 0
    or strpos(lower(posts.recipe->>'ingredients'), lower(left(btrim(term), 80))) > 0
    or strpos(lower(cook.handle), lower(ltrim(left(btrim(term), 80), '@'))) > 0
    or strpos(lower(cook.name), lower(left(btrim(term), 80))) > 0
  order by posts.published_at desc, posts.id limit 40
$$;
revoke execute on function public.search_recipe_posts(text) from public;
grant execute on function public.search_recipe_posts(text) to authenticated;
