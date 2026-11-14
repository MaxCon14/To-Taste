import { parseIngredient } from './ingredients.ts';

export type ShoppingItem = { id: string; line: string; recipe: string; checked: boolean };

type ShoppingGroup = { key: string; name: string; items: ShoppingItem[] };

const singularProduce: Record<string, string> = {
  apples: 'apple', avocados: 'avocado', bananas: 'banana', carrots: 'carrot',
  cucumbers: 'cucumber', eggs: 'egg', lemons: 'lemon', limes: 'lime',
  mushrooms: 'mushroom', onions: 'onion', oranges: 'orange', peppers: 'pepper',
  potatoes: 'potato', shallots: 'shallot', tomatoes: 'tomato', zucchini: 'zucchini',
};

export function shoppingIngredientKey(name: string) {
  return name.toLowerCase().normalize('NFC').trim().replace(/\s+/g, ' ')
    .replace(/\p{L}+$/u, word => Object.hasOwn(singularProduce, word) ? singularProduce[word] : word);
}

export function groupShoppingItems(items: ShoppingItem[]) {
  const groups = new Map<string, ShoppingGroup>();
  for (const item of items) {
    const name = parseIngredient(item.line).name;
    const key = shoppingIngredientKey(name);
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { key, name, items: [item] });
  }
  return [...groups.values()];
}

export function groupShoppingByRecipe(items: ShoppingItem[]) {
  const recipes = new Map<string, ShoppingGroup>();
  for (const item of items) {
    let key = `title:${item.recipe}`;
    try {
      const id: unknown = JSON.parse(item.id);
      if (Array.isArray(id) && typeof id[0] === 'string' && typeof id[1] === 'number') key = `recipe:${id[0]}`;
    } catch {
      // Older items without an encoded recipe ID can still be grouped by title.
    }
    const recipe = recipes.get(key);
    if (recipe) recipe.items.push(item);
    else recipes.set(key, { key, name: item.recipe, items: [item] });
  }
  return [...recipes.values()];
}
