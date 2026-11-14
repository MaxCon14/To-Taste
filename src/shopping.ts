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
