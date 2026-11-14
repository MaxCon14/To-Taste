import { randomUUID } from 'expo-crypto';
import type { Recipe } from './recipes';
import { requireSupabase } from './supabase';

export const defaultCollectionName = 'My collection';
export type SavedCollection = { id: string; name: string; recipeIds: string[] };
export type NewCollection = { id: string; name: string };

export async function readCollections(userId: string): Promise<SavedCollection[]> {
  const client = requireSupabase();
  const pageSize = 500;
  const collections = new Map<string, SavedCollection>();
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('saved_collections').select('id,name').eq('user_id', userId)
      .order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data) collections.set(row.id, { ...row, recipeIds: [] });
    if (data.length < pageSize) break;
  }
  if (!collections.size) return [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('saved_collection_recipes').select('collection_id,recipe_id').eq('user_id', userId)
      .order('added_at', { ascending: false }).order('collection_id').order('recipe_id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data) collections.get(row.collection_id)?.recipeIds.push(row.recipe_id);
    if (data.length < pageSize) break;
  }
  return [...collections.values()];
}

function collectionError(error: { code?: string }, fallback: string) {
  return new Error(error.code === '23505' ? 'You already have a collection with that name.' : fallback);
}

export async function changeRecipeCollections(recipe: Recipe, add: string[], remove: string[], created?: NewCollection) {
  const { error } = await requireSupabase().rpc('change_recipe_collections', {
    target_id: recipe.id, snapshot: { ...recipe, favorite: false }, add_to: add, remove_from: remove,
    ...(created && { new_id: created.id, new_name: created.name }),
  });
  if (error) throw collectionError(error, 'Couldn’t update your collections. Try again.');
}

export async function saveCollection(userId: string, id: string, name: string, exists: boolean) {
  const table = requireSupabase().from('saved_collections');
  const { error } = await (exists
    ? table.update({ name }).eq('user_id', userId).eq('id', id)
    : table.upsert({ id, name }, { onConflict: 'user_id,id', ignoreDuplicates: true }));
  if (error) throw collectionError(error, 'Couldn’t save this collection. Try again.');
}

export async function deleteCollection(userId: string, id: string) {
  const { error } = await requireSupabase().from('saved_collections').delete().eq('user_id', userId).eq('id', id);
  if (error) throw new Error('Couldn’t delete this collection. Try again.');
}

export async function importLegacySaves(userId: string, recipes: Recipe[]) {
  const legacy = recipes.filter(recipe => recipe.favorite || recipe.discovery || recipe.id.startsWith('community:'));
  if (!legacy.length) return;
  const collections = await readCollections(userId);
  const saved = new Set(collections.flatMap(collection => collection.recipeIds));
  const unsorted = legacy.filter(recipe => !saved.has(recipe.id));
  if (!unsorted.length) return;
  const destination = collections.find(collection => collection.name.toLowerCase() === defaultCollectionName.toLowerCase());
  const id = destination?.id ?? randomUUID();
  if (!destination) await saveCollection(userId, id, defaultCollectionName, false);
  for (const recipe of unsorted) await changeRecipeCollections(recipe, [id], []);
}
