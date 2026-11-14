import type { Diet, Recipe } from './recipes';
import type { ShareOptions } from './FlowSheets';
import { requireSupabase, supabase } from './supabase';
import { allergens, readCookingPreferences, type Allergen, type Personalization } from './allergens';

export type Account = { id: string; name: string; diet: Diet; personalization?: Personalization; username?: string };
export type Session = { user: Account | null; recipes: Recipe[] };
export const accountsConfigured = Boolean(supabase);

type CookbookRow = { id: string; recipe: Recipe };
type Publication = { id: string; user_id: string; recipe_id: string; recipe: Recipe; options: ShareOptions };

async function cookbook(userId: string): Promise<Recipe[]> {
  const recipes: Recipe[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await requireSupabase().from('cookbook_recipes').select('id,recipe').eq('user_id', userId)
      .order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data as CookbookRow[];
    recipes.push(...page.map(row => ({ ...row.recipe, id: row.id })));
    if (page.length < pageSize) return recipes;
  }
}

export async function readSession(): Promise<Session> {
  if (!supabase) return { user: null, recipes: [] };
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return { user: null, recipes: [] };
  const id = session.user.id;
  const [profile, recipes, cook] = await Promise.all([
    supabase.from('profiles').select('display_name,diet').eq('user_id', id).maybeSingle(),
    cookbook(id),
    supabase.from('cook_profiles').select('handle,name').eq('user_id', id).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (cook.error) throw cook.error;
  const raw = session.user.user_metadata?.to_taste_preferences;
  const cooking = readCookingPreferences(raw?.cooking);
  const personalization: Personalization | undefined = raw && Array.isArray(raw.allergens)
    && cooking !== null
    ? { allergens: [...new Set<Allergen>(raw.allergens.filter((item: unknown) => typeof item === 'string' && Object.hasOwn(allergens, item)))], cooking }
    : undefined;
  const providerName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name;
  const name = cook.data?.name || profile.data?.display_name || (typeof providerName === 'string' ? providerName.slice(0, 60) : '');
  return { user: { id, name, diet: profile.data?.diet ?? 'any', personalization, username: cook.data?.handle }, recipes };
}

export async function savePersonalization(preferences: Personalization) {
  const { error } = await requireSupabase().auth.updateUser({ data: { to_taste_preferences: preferences } });
  if (error) throw error;
}

export type AppFeedback = { kind: 'feedback' | 'help'; message: string } | { kind: 'rating'; rating: number };

export async function submitAppFeedback(submission: AppFeedback) {
  const { error } = await requireSupabase().from('app_feedback').insert({
    kind: submission.kind,
    message: submission.kind === 'rating' ? null : submission.message,
    rating: submission.kind === 'rating' ? submission.rating : null,
  });
  if (error) throw new Error('We couldn’t send this right now. Try again in a moment.');
}

export async function saveProfile(id: string, values: { display_name?: string; diet?: Diet }): Promise<Account> {
  const { data, error } = await requireSupabase().from('profiles').upsert({ user_id: id, ...values }, { onConflict: 'user_id' })
    .select('display_name,diet').single();
  if (error) throw error;
  return { id, name: data.display_name, diet: data.diet };
}

export async function readCommunity(cookId?: string): Promise<Recipe[]> {
  if (!supabase) return [];
  const query = supabase.from('community_recipes').select('id,user_id,recipe,options');
  const { data, error } = await (cookId ? query.eq('user_id', cookId) : query)
    .order('published_at', { ascending: false }).order('id').limit(100);
  if (error) throw error;
  return publishedRecipes(data as Publication[]);
}

export async function readFollowingRecipes(): Promise<Recipe[]> {
  const { data, error } = await requireSupabase().rpc('followed_recipes');
  if (error) throw error;
  return publishedRecipes(data as Publication[]);
}

export async function searchRecipePosts(term: string) {
  const { data, error } = await requireSupabase().rpc('search_recipe_posts', { term });
  if (error) throw error;
  return publishedRecipes(data as Publication[]);
}

export async function readBookRecipes(ids: string[]) {
  const { data, error } = await requireSupabase().from('community_recipes').select('id,user_id,recipe,options').in('id', ids);
  if (error) throw error;
  const posts = new Map(publishedRecipes(data as Publication[]).map(recipe => [recipe.id, recipe]));
  return ids.flatMap(id => posts.get(`community:${id}`) ?? []);
}

function publishedRecipes(rows: Publication[]): Recipe[] {
  return rows.map(row => ({
    ...row.recipe, id: `community:${row.id}`, favorite: false,
    discovery: { author: row.recipe.discovery?.author || 'From the community', authorId: row.user_id,
      diet: row.options.diet === 'any' ? undefined : row.options.diet, onePan: row.options.onePan, weekend: row.options.weekend },
  }));
}

export async function saveRecipe(userId: string, id: string, recipe?: Recipe) {
  const table = requireSupabase().from('cookbook_recipes');
  const result = recipe
    ? await table.upsert({ user_id: userId, id, recipe }, { onConflict: 'user_id,id' })
    : await table.delete().eq('user_id', userId).eq('id', id);
  if (result.error) throw result.error;
}

export async function importGuestRecipes(userId: string, recipes: Recipe[]) {
  const client = requireSupabase();
  for (let start = 0; start < recipes.length; start += 20) {
    const rows = recipes.slice(start, start + 20).map(recipe => ({ user_id: userId, id: recipe.id, recipe }));
    const { error } = await client.from('cookbook_recipes').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw error;
  }
  return cookbook(userId);
}

export async function readPublications(userId: string): Promise<Record<string, ShareOptions>> {
  const { data, error } = await requireSupabase().from('community_recipes').select('recipe_id,options').eq('user_id', userId);
  if (error) throw error;
  return Object.fromEntries((data as Publication[]).map(row => [row.recipe_id, row.options]));
}

export async function publishRecipe(account: Account, recipe: Recipe, options: ShareOptions) {
  const { error } = await requireSupabase().from('community_recipes').upsert({
    user_id: account.id, recipe_id: recipe.id, options, recipe: {
      ...recipe, favorite: false, discovery: { author: account.name },
    },
  }, { onConflict: 'user_id,recipe_id' });
  if (error) throw error;
}

export async function unpublishRecipe(userId: string, id: string) {
  const { error } = await requireSupabase().from('community_recipes').delete().eq('user_id', userId).eq('recipe_id', id);
  if (error) throw error;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
  if (error) throw error;
}
