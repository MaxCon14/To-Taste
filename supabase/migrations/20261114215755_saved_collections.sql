create table public.saved_collections (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create unique index saved_collections_unique_name on public.saved_collections (user_id, lower(btrim(name)));

create table public.saved_collection_recipes (
  user_id uuid not null default auth.uid(),
  collection_id uuid not null,
  recipe_id text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, collection_id, recipe_id),
  foreign key (user_id, collection_id) references public.saved_collections(user_id, id) on delete cascade,
  foreign key (user_id, recipe_id) references public.cookbook_recipes(user_id, id) on delete cascade
);
create index saved_collection_recipes_recipe_idx on public.saved_collection_recipes (user_id, recipe_id);

alter table public.saved_collections enable row level security;
alter table public.saved_collection_recipes enable row level security;
revoke all on public.saved_collections, public.saved_collection_recipes from public, anon, authenticated;
grant select, delete on public.saved_collections, public.saved_collection_recipes to authenticated;
grant insert (id, name), update (name) on public.saved_collections to authenticated;
grant insert (collection_id, recipe_id) on public.saved_collection_recipes to authenticated;
create policy "Manage own collections" on public.saved_collections for all to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Manage own collection recipes" on public.saved_collection_recipes for all to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));

with migrated_users as (
  select distinct user_id from public.cookbook_recipes
  where recipe->>'favorite' = 'true' or recipe ? 'discovery' or id like 'community:%'
), created as (
  insert into public.saved_collections (user_id, name)
  select user_id, 'My collection' from migrated_users
  returning user_id, id
)
insert into public.saved_collection_recipes (user_id, collection_id, recipe_id)
select recipe.user_id, created.id, recipe.id
from public.cookbook_recipes as recipe join created using (user_id)
where recipe.recipe->>'favorite' = 'true' or recipe.recipe ? 'discovery' or recipe.id like 'community:%';

create function public.change_recipe_collections(
  target_id text, snapshot jsonb, add_to uuid[], remove_from uuid[],
  new_id uuid default null, new_name text default null
)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise insufficient_privilege;
  end if;
  if new_id is not null then
    insert into public.saved_collections (id, name) values (new_id, btrim(new_name))
    on conflict (user_id, id) do nothing;
  end if;
  if coalesce(cardinality(add_to), 0) > 0 or new_id is not null then
    insert into public.cookbook_recipes (user_id, id, recipe)
    values (owner_id, target_id, snapshot)
    on conflict (user_id, id) do nothing;
    insert into public.saved_collection_recipes (collection_id, recipe_id)
    select destination, target_id from unnest(array_cat(add_to, array_remove(array[new_id], null))) destination
    on conflict do nothing;
  end if;
  delete from public.saved_collection_recipes
  where user_id = owner_id and recipe_id = target_id and collection_id = any(remove_from);
end;
$$;
revoke execute on function public.change_recipe_collections(text,jsonb,uuid[],uuid[],uuid,text) from public, anon;
grant execute on function public.change_recipe_collections(text,jsonb,uuid[],uuid[],uuid,text) to authenticated;
