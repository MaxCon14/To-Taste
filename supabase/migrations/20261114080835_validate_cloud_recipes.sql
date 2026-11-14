create function public.valid_recipe_document(doc jsonb)
returns boolean language sql immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(doc->'title') = 'string' and length(trim(doc->>'title')) between 1 and 240
    and jsonb_typeof(doc->'minutes') = 'string' and length(doc->>'minutes') <= 12
    and jsonb_typeof(doc->'servings') = 'string' and length(doc->>'servings') <= 100
    and jsonb_typeof(doc->'ingredients') = 'string' and length(trim(doc->>'ingredients')) between 1 and 24000
    and jsonb_typeof(doc->'instructions') = 'string' and length(doc->>'instructions') <= 50000
    and (not (doc ? 'source') or (jsonb_typeof(doc->'source') = 'string' and doc->>'source' ~ '^https://[^[:space:]]+$' and length(doc->>'source') <= 2048))
    and (not (doc ? 'photo') or (jsonb_typeof(doc->'photo') = 'string' and doc->>'photo' ~ '^https://[^[:space:]]+$' and length(doc->>'photo') <= 2048))
    and (not (doc ? 'cover') or doc->>'cover' in ('pasta','chicken','pancakes','chickpeas','salmon'))
  , false);
$$;

alter table public.cookbook_recipes
  add constraint cookbook_recipe_fields check (public.valid_recipe_document(recipe));
alter table public.community_recipes
  add constraint published_recipe_fields check (public.valid_recipe_document(recipe)),
  add constraint published_recipe_options check (coalesce(
    options->>'diet' in ('any','vegan','vegetarian','pescatarian')
    and jsonb_typeof(options->'onePan') = 'boolean'
    and jsonb_typeof(options->'weekend') = 'boolean', false)
  );
