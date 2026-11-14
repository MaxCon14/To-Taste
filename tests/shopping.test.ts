import assert from 'node:assert/strict';
import test from 'node:test';
import { groupShoppingItems } from '../src/shopping.ts';

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
