import assert from 'node:assert/strict';
import test from 'node:test';
import { allergenWarnings, warningLabels } from '../src/allergens.ts';

test('distinguishes explicit allergens from ingredients that need a label check', () => {
  const warnings = allergenWarnings('2 tbsp tahini\n1 tbsp soy sauce\n1 tsp peanut butter', ['sesame', 'gluten', 'peanuts']);
  assert.deepEqual(warningLabels(warnings), ['Contains sesame', 'Check for gluten-containing cereals', 'Contains peanuts']);
});

test('does not label qualified ingredients as confirmed matches', () => {
  assert.deepEqual(warningLabels(allergenWarnings('Oat milk', ['milk'])), ['Check for milk']);
  assert.deepEqual(warningLabels(allergenWarnings('Gluten-free flour', ['gluten'])), ['Check for gluten-containing cereals']);
});
