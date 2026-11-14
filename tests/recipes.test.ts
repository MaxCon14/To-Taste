import assert from 'node:assert/strict';
import test from 'node:test';
import { ingredientAmount, parseIngredient } from '../src/ingredients.ts';
import { isSocialRecipeLink, normalizeRecipeUrl, recipeFromCaption, recipeFromHtml } from '../src/importRecipe.ts';

test('imports only quantities and steps actually written in a recipe caption', () => {
  const source = 'https://www.instagram.com/reel/example/';
  const draft = recipeFromCaption('Tomato pasta\n\nIngredients:\n- 2 tomatoes\n- Olive oil\n\nDirections:\n1. Roast the tomatoes.\n2. Toss with pasta.\n#dinner', source);
  assert.equal(draft?.ingredients, '2 tomatoes\nOlive oil');
  assert.equal(draft?.instructions, 'Roast the tomatoes.\nToss with pasta.');
  assert.equal(draft?.minutes, '');
  assert.equal(draft?.source, source);
  assert.equal(recipeFromCaption('Quick pasta! #dinner', source), undefined);
});

test('recognizes social video hosts without matching lookalike domains', () => {
  assert.equal(isSocialRecipeLink('https://vm.tiktok.com/example/'), true);
  assert.equal(isSocialRecipeLink('https://youtu.be/example'), true);
  assert.equal(isSocialRecipeLink('https://instagram.com.example.org/reel/example/'), false);
});

test('turns a typed onion count into a multiplier and icon', () => {
  const onion = parseIngredient('2 Onions');
  assert.equal(onion.emoji, '🧅');
  assert.equal(ingredientAmount(onion), '2 ×');
  assert.equal(onion.name, 'Onions');
});

test('keeps mixed fractions, units, ranges and preparation notes', () => {
  const tomato = parseIngredient('1 1/2 cups cherry tomatoes, halved');
  assert.equal(tomato.emoji, '🍅');
  assert.equal(ingredientAmount(tomato), '1 1/2 cups');
  assert.equal(tomato.name, 'Cherry tomatoes, halved');
  assert.equal(ingredientAmount(parseIngredient('2–3 cloves garlic')), '2–3 cloves');
  assert.equal(ingredientAmount(parseIngredient('250ml milk')), '250 ml');
  assert.equal(ingredientAmount(parseIngredient('½ cup cream')), '½ cup');
});

test('preserves text for unmeasured and unfamiliar ingredients', () => {
  assert.equal(parseIngredient('Salt, to taste').name, 'Salt, to taste');
  const unknown = parseIngredient('2 tsp sumac');
  assert.equal(unknown.emoji, '🥣');
  assert.equal(unknown.name, 'Sumac');
  assert.equal(ingredientAmount(unknown), '2 tsp');
});

test('imports editable recipe data from a graph, including directions in sections', () => {
  const draft = recipeFromHtml(`
    <script type="application/ld+json">{broken}</script>
    <script type='application/ld+json'>{
      "@graph": [{"@type":"Article"},{"@type":["Thing","Recipe"],"name":"Soup &amp; bread",
      "recipeIngredient":["2 Onions","&frac12; cup cream"],"prepTime":"PT10M","cookTime":"PT35M",
      "recipeYield":[4],"image":[{"url":"/cover.jpg"}],"recipeInstructions":[
        {"@type":"HowToSection","name":"Cook","itemListElement":[{"text":"Stir &amp; simmer."},{"text":"Serve warm."}]}
      ]}]}
    </script>`, 'https://example.com/soup');
  assert.equal(draft?.title, 'Soup & bread');
  assert.equal(draft?.ingredients, '2 Onions\n½ cup cream');
  assert.equal(draft?.minutes, '45');
  assert.equal(draft?.servings, '4');
  assert.equal(draft?.instructions, 'Stir & simmer.\nServe warm.');
  assert.equal(draft?.photo, 'https://example.com/cover.jpg');
});

test('reports unsupported pages and rejects non-web URLs', () => {
  assert.equal(recipeFromHtml('<h1>Recipe blog</h1>', 'https://example.com'), undefined);
  assert.equal(normalizeRecipeUrl('example.com/soup#notes'), 'https://example.com/soup');
  assert.throws(() => normalizeRecipeUrl('file:///secret'));
  assert.throws(() => normalizeRecipeUrl('https://user:password@example.com'));
});
