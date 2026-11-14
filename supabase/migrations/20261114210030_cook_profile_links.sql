alter table public.cook_profiles
  add column banner text not null default 'pasta' check (banner in ('pasta', 'chicken', 'pancakes', 'chickpeas', 'salmon')),
  add column website text not null default '' check (char_length(website) <= 300 and (website = '' or website ~ '^https://[^[:space:]]+$')),
  add column social_link text not null default '' check (char_length(social_link) <= 300 and (social_link = '' or social_link ~ '^https://[^[:space:]]+$'));
grant insert (banner, website, social_link), update (banner, website, social_link) on public.cook_profiles to authenticated;
