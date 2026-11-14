import { requireSupabase } from './supabase';

export type Cook = { user_id: string; handle: string; name: string; bio: string };
export type CookLookup = { id: string } | { handle: string };
export type RecipeBook = { id: string; cook_id: string; title: string; post_ids: string[] };
const bookFields = 'id,cook_id,title,post_ids';

export async function searchBooks(term: string) {
  const { data, error } = await requireSupabase().rpc('search_recipe_books', { term });
  if (error) throw error;
  return data as RecipeBook[];
}

export async function readCookBooks(cookId: string) {
  const { data, error } = await requireSupabase().from('recipe_books').select(bookFields).eq('cook_id', cookId)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function saveBook(title: string, postIds: string[]) {
  const { error } = await requireSupabase().from('recipe_books').insert({ title, post_ids: postIds });
  if (error) throw new Error('Couldn’t publish your book. Make sure its recipes are still published.');
}

export async function readCook(lookup: CookLookup) {
  const query = requireSupabase().from('cook_profiles').select('user_id,handle,name,bio');
  const { data, error } = await ('id' in lookup ? query.eq('user_id', lookup.id) : query.eq('handle', lookup.handle)).maybeSingle<Cook>();
  if (error) throw error;
  return data;
}

export async function searchCooks(term: string) {
  const { data, error } = await requireSupabase().rpc('search_cooks', { term: term.trim() });
  if (error) throw error;
  return data as Cook[];
}

export async function saveCook(cook: Omit<Cook, 'user_id'>, edit: boolean, ownerId: string) {
  const table = requireSupabase().from('cook_profiles');
  const { data, error } = await (edit ? table.update(cook).eq('user_id', ownerId) : table.insert(cook))
    .select('user_id,handle,name,bio').single<Cook>();
  if (error?.code === '23505') throw new Error('That handle is already taken. Try another one.');
  if (error) throw new Error('Couldn’t save your public profile. Try again.');
  return data;
}

export async function readFollow(cookId: string) {
  const { data, error } = await requireSupabase().from('cook_follows').select('cook_id').eq('cook_id', cookId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function setFollow(cookId: string, following: boolean) {
  const table = requireSupabase().from('cook_follows');
  const { error } = following ? await table.insert({ cook_id: cookId }) : await table.delete().eq('cook_id', cookId);
  if (error && !(following && error.code === '23505')) throw new Error('Couldn’t update your follows. Try again.');
}
