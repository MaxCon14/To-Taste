create table public.shopping_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 2400),
  line text not null check (char_length(line) between 1 and 2000),
  recipe text not null check (char_length(recipe) between 1 and 240),
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index shopping_items_order_idx on public.shopping_items (user_id, created_at, id);
alter table public.shopping_items enable row level security;
revoke all on public.shopping_items from public, anon, authenticated;
grant select, delete on public.shopping_items to authenticated;
grant insert (id, line, recipe, checked), update (checked) on public.shopping_items to authenticated;
create policy "Own shopping items" on public.shopping_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.apply_shopping_changes(added jsonb, toggled jsonb, removed text[])
returns void language sql security invoker set search_path = ''
as $$
  insert into public.shopping_items (id, line, recipe, checked)
  select id, line, recipe, checked from jsonb_to_recordset(added) as item(id text, line text, recipe text, checked boolean)
  on conflict (user_id, id) do nothing;
  update public.shopping_items as item set checked = change.checked
  from jsonb_to_recordset(toggled) as change(id text, checked boolean)
  where item.user_id = (select auth.uid()) and item.id = change.id;
  delete from public.shopping_items where user_id = (select auth.uid()) and id = any(removed);
$$;
revoke execute on function public.apply_shopping_changes(jsonb,jsonb,text[]) from public, anon;
grant execute on function public.apply_shopping_changes(jsonb,jsonb,text[]) to authenticated;

create table public.cooked_recipes (
  user_id uuid not null default auth.uid(),
  recipe_id text not null,
  cooked_at timestamptz not null default now(),
  primary key (user_id, recipe_id),
  foreign key (user_id, recipe_id) references public.cookbook_recipes(user_id, id) on delete cascade
);
create index cooked_recipes_order_idx on public.cooked_recipes (user_id, cooked_at desc, recipe_id);
alter table public.cooked_recipes enable row level security;
revoke all on public.cooked_recipes from public, anon, authenticated;
grant select, delete on public.cooked_recipes to authenticated;
grant insert (recipe_id, cooked_at), update (cooked_at) on public.cooked_recipes to authenticated;
create policy "Own cooked history" on public.cooked_recipes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.mark_recipe_cooked(target_id text, snapshot jsonb)
returns void language sql security invoker set search_path = ''
as $$
  insert into public.cookbook_recipes (user_id, id, recipe)
  values ((select auth.uid()), target_id, snapshot) on conflict (user_id, id) do nothing;
  insert into public.cooked_recipes (recipe_id) values (target_id)
  on conflict (user_id, recipe_id) do update set cooked_at = now();
$$;
revoke execute on function public.mark_recipe_cooked(text,jsonb) from public, anon;
grant execute on function public.mark_recipe_cooked(text,jsonb) to authenticated;

create schema if not exists private;
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references public.cook_profiles(user_id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id, blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (blocked_id, label) on public.user_blocks to authenticated;
create policy "Own blocks" on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create function private.accounts_blocked(other_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = (select auth.uid()) and blocked_id = other_id)
       or (blocked_id = (select auth.uid()) and blocker_id = other_id)
  );
$$;
revoke execute on function private.accounts_blocked(uuid) from public;
grant execute on function private.accounts_blocked(uuid) to anon, authenticated;

create function private.remove_blocked_follows()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.cook_follows
  where (follower_id = new.blocker_id and cook_id = new.blocked_id)
     or (cook_id = new.blocker_id and follower_id = new.blocked_id);
  return new;
end;
$$;
revoke execute on function private.remove_blocked_follows() from public, anon, authenticated;
create trigger clear_follows_on_block after insert on public.user_blocks
for each row execute function private.remove_blocked_follows();

alter table public.community_recipes add column hidden_at timestamptz;
alter table public.recipe_reviews add column hidden_at timestamptz;
revoke insert, update on public.community_recipes from authenticated;
grant insert (user_id, recipe_id, recipe, options), update (user_id, recipe_id, recipe, options)
  on public.community_recipes to authenticated;
alter policy "Read published recipes" on public.community_recipes
  using (hidden_at is null and not private.accounts_blocked(user_id));
alter policy "Read public cook profiles" on public.cook_profiles using (not private.accounts_blocked(user_id));
alter policy "Signed-in users read recipe reviews" on public.recipe_reviews
  using (hidden_at is null and not private.accounts_blocked(user_id));
alter policy "Read published books" on public.recipe_books to anon, authenticated
  using (not private.accounts_blocked(cook_id));
grant select on public.recipe_books to anon;
create policy "Blocks prevent new follows" on public.cook_follows as restrictive for insert to authenticated
  with check (not private.accounts_blocked(cook_id));

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('recipe', 'review')),
  target_id uuid not null,
  reason text not null check (reason in ('unsafe', 'copied', 'spam', 'abuse', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'dismissed', 'removed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index content_reports_queue_idx on public.content_reports (status, created_at desc);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from public, anon, authenticated;
grant insert (target_type, target_id, reason, details) on public.content_reports to authenticated;
create policy "Report visible content" on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and
    ((target_type = 'recipe' and exists (select 1 from public.community_recipes where id = target_id))
      or (target_type = 'review' and exists (select 1 from public.recipe_reviews where id = target_id))));

create function private.remove_reported_content()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.target_type = 'recipe' then
    update public.community_recipes set hidden_at = now() where id = new.target_id;
  else
    update public.recipe_reviews set hidden_at = now() where id = new.target_id;
  end if;
  return new;
end;
$$;
revoke execute on function private.remove_reported_content() from public, anon, authenticated;
create trigger hide_removed_content after update of status on public.content_reports
for each row when (new.status = 'removed' and old.status is distinct from new.status)
execute function private.remove_reported_content();
