import assert from 'node:assert/strict';
import test from 'node:test';
import { groupShoppingByRecipe, groupShoppingItems } from '../src/shopping.ts';

test('groups shopping entries by recipe ID even when recipes share a title', () => {
  const item = (recipeId: string, index: number, line: string) => ({
    id: JSON.stringify([recipeId, index, line]), recipe: 'Soup', line, checked: false,
  });
  const a = item('a', 0, '2 onions');
  const b = item('b', 0, '1 onion');
  const c = item('a', 1, '1 carrot');

  assert.deepEqual(groupShoppingByRecipe([a, b, c]).map(group => group.items), [[a, c], [b]]);
});

test('groups shared ingredients and retains original recipe quantities and checked states', () => {
  const first = { id: '1', line: '2 onions', recipe: 'Soup', checked: true };
  const second = { id: '2', line: '1 Onion', recipe: 'Pasta', checked: false };
  const third = { id: '3', line: '100 g onion', recipe: 'Salad', checked: false };
  const groups = groupShoppingItems([first, second, third]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items, [first, second, third]);
});

test('keeps ingredient varieties and preparation distinctions separate', () => {
  const lines = ['2 red onions', '1 green onion', '1 tsp onion powder', '1 onion, diced', '1 lemon', '1 lemon, juiced'];
  const items = lines.map(line => ({ id: line, line, recipe: 'Soup', checked: false }));

  assert.equal(groupShoppingItems(items).length, lines.length);
});
