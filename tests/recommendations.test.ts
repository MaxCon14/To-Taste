import assert from 'node:assert/strict';
import test from 'node:test';
import { readCookingPreferences } from '../src/allergens.ts';
import { recipeRecommendations } from '../src/recipeRecommendations.ts';
import { emptyDraft, type Recipe } from '../src/recipes.ts';

test('restores single cooking preferences and deduplicates multiple selections', () => {
  assert.deepEqual(readCookingPreferences('quick'), ['quick']);
  assert.deepEqual(readCookingPreferences('any'), []);
  assert.deepEqual(readCookingPreferences(['quick', 'onePan', 'quick']), ['quick', 'onePan']);
  assert.equal(readCookingPreferences(null), null);
});

test('prioritizes allergy warnings, then diet, then the number of cooking matches', () => {
  const vegan = { author: 'Test', diet: 'vegan' as const };
  const recipe = (id: string, extra: Partial<Recipe> = {}): Recipe => ({
    ...emptyDraft, id, title: id, ingredients: 'tomatoes', favorite: false, minutes: '20', discovery: vegan, ...extra,
  });
  const recipes = [
    recipe('allergen', { ingredients: 'peanuts', discovery: { ...vegan, onePan: true } }),
    recipe('one match'),
    recipe('wrong diet', { discovery: { author: 'Test', onePan: true } }),
    recipe('two matches', { discovery: { ...vegan, onePan: true } }),
  ];
  assert.deepEqual(recipeRecommendations(recipes, 'vegan', { allergens: ['peanuts'], cooking: ['quick', 'onePan'] })
    .map(({ recipe }) => recipe.id), ['two matches', 'one match', 'wrong diet', 'allergen']);
});
