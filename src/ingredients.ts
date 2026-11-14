export type Ingredient = { original: string; quantity: string; unit: string; name: string; emoji: string; tint: string };

const ingredients: [string, string, string][] = [
  ['🍅', 'peach', 'tomato(?:es)?|passata|salsa'],
  ['🧅', 'lavender', 'onions?|shallots?|scallions?|leeks?'],
  ['🧄', 'lavender', 'garlic'],
  ['🍋', 'yellow', 'lemons?|citrus'],
  ['🍋‍🟩', 'green', 'limes?'],
  ['🥑', 'green', 'avocados?'],
  ['🥕', 'peach', 'carrots?'],
  ['🥔', 'yellow', 'potato(?:es)?|yams?'],
  ['🍆', 'lavender', 'eggplants?|aubergines?'],
  ['🥒', 'green', 'cucumbers?|zucchini|courgettes?'],
  ['🫑', 'green', 'bell peppers?|capsicum'],
  ['🌶️', 'peach', 'chil(?:i|li|ies|lies)|jalape[nñ]os?|cayenne|paprika'],
  ['🥦', 'green', 'broccoli|cauliflower'],
  ['🥬', 'green', 'lettuce|cabbage|spinach|kale|arugula|rocket'],
  ['🌿', 'green', 'basil|parsley|dill|mint|thyme|rosemary|cilantro|coriander|oregano|herbs?'],
  ['🍄', 'peach', 'mushrooms?'],
  ['🌽', 'yellow', 'corn|maize'],
  ['🫒', 'green', 'olives?|olive oil'],
  ['🍝', 'yellow', 'pasta|spaghetti|rigatoni|penne|macaroni|noodles?|linguine|orzo'],
  ['🍚', 'yellow', 'rice|quinoa|couscous'],
  ['🥖', 'yellow', 'bread|toast|baguette|breadcrumbs?|croutons?'],
  ['🍗', 'peach', 'chicken|turkey|poultry'],
  ['🥩', 'peach', 'beef|steak|lamb|pork|veal|mince'],
  ['🥓', 'peach', 'bacon|pancetta|prosciutto|ham'],
  ['🐟', 'lavender', 'fish|salmon|tuna|cod|anchov(?:y|ies)|sardines?'],
  ['🍤', 'peach', 'shrimp|prawns?'],
  ['🥚', 'yellow', 'eggs?'],
  ['🧀', 'yellow', 'cheese|parmesan|mozzarella|feta|cheddar|ricotta|pecorino'],
  ['🥛', 'lavender', 'milk|cream|yog(?:h)?urt|buttermilk'],
  ['🧈', 'yellow', 'butter|ghee|margarine'],
  ['🥜', 'yellow', 'peanuts?|almonds?|walnuts?|pecans?|cashews?|pistachios?|nuts?'],
  ['🫘', 'peach', 'beans?|lentils?|chickpeas?'],
  ['🫐', 'lavender', 'blueberr(?:y|ies)|blackberr(?:y|ies)'],
  ['🍓', 'peach', 'strawberr(?:y|ies)|raspberr(?:y|ies)'],
  ['🍌', 'yellow', 'bananas?'],
  ['🍎', 'peach', 'apples?'],
  ['🍊', 'peach', 'oranges?|mandarins?'],
  ['🍑', 'peach', 'peach(?:es)?|nectarines?'],
  ['🍍', 'yellow', 'pineapples?'],
  ['🥭', 'yellow', 'mango(?:es|s)?'],
  ['🥥', 'yellow', 'coconuts?'],
  ['🍫', 'lavender', 'chocolate|cocoa|cacao'],
  ['🍯', 'yellow', 'honey|syrup|molasses'],
  ['🧂', 'lavender', 'salt|pepper(?:corns?)?'],
  ['🌾', 'yellow', 'flour|oats?|starch|wheat'],
  ['🧁', 'lavender', 'baking powder|baking soda|yeast'],
  ['🍬', 'peach', 'sugar|sweetener'],
  ['💧', 'lavender', 'water|stock|broth'],
  ['🫙', 'yellow', 'oil|vinegar|sauce|paste|jam'],
];

const aliases = ingredients.map(([emoji, tint, names]) => ({
  emoji, tint, match: new RegExp(`\\b(?:${names})\\b`, 'i'),
}));

const amount = String.raw`(?:\d+\s+\d+\s*[/⁄]\s*\d+|\d+\s*[/⁄]\s*\d+|\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚⅐⅑⅒]|\d+(?:[.,]\d+)?|\.\d+)`;
const quantityPattern = new RegExp(`^(${amount}(?:\\s*(?:[-–—]|\\bto\\b)\\s*${amount})?)`, 'i');
const unitPattern = /^(tablespoons?|teaspoons?|cups?|tbsp\.?|tsp\.?|kilograms?|milligrams?|grams?|millilit(?:er|re)s?|lit(?:er|re)s?|kg|mg|g|ml|dl|l|ounces?|fluid ounces?|fl\s*oz\.?|oz\.?|pounds?|lbs?\.?|pinch(?:es)?|handfuls?|cloves?|cans?|tins?|slices?|bunch(?:es)?|stalks?|sprigs?|heads?|packages?|packs?|sticks?|pieces?|drops?)(?=\s|$)/i;

export function parseIngredient(original: string): Ingredient {
  const cleaned = original.trim().replace(/^[-•]\s+/, '');
  const match = cleaned.match(quantityPattern);
  const quantity = match?.[1].trim() ?? '';
  const remainder = cleaned.slice(match?.[0].length ?? 0).trim().replace(/^[x×]\s+/i, '');
  const possibleUnit = quantity ? remainder.match(unitPattern)?.[0] ?? '' : '';
  const candidate = remainder.slice(possibleUnit.length).trim().replace(/^of\s+/i, '');
  const unit = candidate ? possibleUnit : '';
  const name = (candidate || remainder || cleaned).replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  const primary = name.split(/[,;(]|\s+to (?:taste|serve)\b/i)[0];
  const matches = aliases.flatMap((alias) => {
    const result = primary.match(alias.match);
    return result ? [{ ...alias, index: result.index ?? 0, length: result[0].length }] : [];
  });
  matches.sort((a, b) => a.index - b.index || b.length - a.length);
  return { original, quantity, unit, name, emoji: matches[0]?.emoji ?? '🥣', tint: matches[0]?.tint ?? 'cream' };
}

export function ingredientAmount(ingredient: Ingredient) {
  if (!ingredient.quantity) return '';
  return ingredient.unit ? `${ingredient.quantity} ${ingredient.unit}` : `${ingredient.quantity} ×`;
}
