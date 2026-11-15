import type { Recipe } from './recipes';
import type { ShoppingItem } from './shopping';
import { requireSupabase } from './supabase';

export async function readShopping(userId: string): Promise<ShoppingItem[]> {
  const items: ShoppingItem[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await requireSupabase().from('shopping_items').select('id,line,recipe,checked')
      .eq('user_id', userId).order('created_at').order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    items.push(...data);
    if (data.length < pageSize) return items;
  }
}

export async function writeShopping(previous: ShoppingItem[], next: ShoppingItem[]) {
  const old = new Map(previous.map(item => [item.id, item.checked]));
  const current = new Set(next.map(item => item.id));
  const { error } = await requireSupabase().rpc('apply_shopping_changes', {
    added: next.filter(item => !old.has(item.id)),
    toggled: next.filter(item => old.has(item.id) && old.get(item.id) !== item.checked)
      .map(({ id, checked }) => ({ id, checked })),
    removed: previous.filter(item => !current.has(item.id)).map(item => item.id),
  });
  if (error) throw new Error('Couldn’t sync your shopping list. Try again.');
}

export type CookedRecipe = { recipe_id: string; cooked_at: string };

export async function readCooked(userId: string): Promise<CookedRecipe[]> {
  const { data, error } = await requireSupabase().from('cooked_recipes').select('recipe_id,cooked_at')
    .eq('user_id', userId).order('cooked_at', { ascending: false }).order('recipe_id').limit(100);
  if (error) throw error;
  return data;
}

export async function markCooked(recipe: Recipe) {
  const { error } = await requireSupabase().rpc('mark_recipe_cooked', { target_id: recipe.id, snapshot: { ...recipe, favorite: false } });
  if (error) throw new Error('Couldn’t update your cooking history. Try again.');
}
