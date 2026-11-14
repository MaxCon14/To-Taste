export const allergens = {
  gluten: 'Gluten-containing cereals', crustaceans: 'Crustaceans', eggs: 'Eggs', fish: 'Fish',
  peanuts: 'Peanuts', soy: 'Soy', milk: 'Milk', nuts: 'Tree nuts', celery: 'Celery',
  mustard: 'Mustard', sesame: 'Sesame', sulphites: 'Sulphites', lupin: 'Lupin', molluscs: 'Molluscs',
} as const;
export type Allergen = keyof typeof allergens;
export const cookingStyles = { any: 'No preference', quick: 'Quick dinners', onePan: 'One-pan meals', prep: 'Meal prep' } as const;
export type CookingStyle = keyof typeof cookingStyles;
export type Personalization = { allergens: Allergen[]; cooking: CookingStyle };

const explicit: Record<Allergen, RegExp> = {
  gluten: /\b(wheat|barley|rye|spelt|oats?|gluten)\b/i,
  crustaceans: /\b(shrimp|prawns?|crabs?|lobsters?|crayfish)\b/i,
  eggs: /\beggs?\b/i, fish: /\b(fish|salmon|tuna|cod|anchov(?:y|ies)|sardines?)\b/i,
  peanuts: /\bpeanuts?\b/i, soy: /\b(soy(?:beans?)?|soya|tofu|edamame|tempeh)\b/i,
  milk: /\b(milk|buttermilk|whey|casein|ghee|cheese|parmesan|mozzarella|feta|cheddar|ricotta|yog[hu]+rt)\b/i,
  nuts: /\b(almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamias?|brazil nuts?)\b/i,
  celery: /\b(celery|celeriac)\b/i, mustard: /\bmustard\b/i,
  sesame: /\b(sesame|tahini)\b/i, sulphites: /\b(sulphites?|sulfites?|sulfur dioxide|sulphur dioxide)\b/i,
  lupin: /\blupin(?:e|s)?\b/i, molluscs: /\b(mussels?|oysters?|squid|clams?|octopus|scallops?|snails?)\b/i,
};
const uncertain: Partial<Record<Allergen, RegExp>> = {
  gluten: /\b(flour|pasta|bread|breadcrumbs|soy sauce|stock)\b/i,
  milk: /\b(cream|butter|chocolate|pesto)\b/i,
  eggs: /\b(mayonnaise|pasta|noodles)\b/i,
  nuts: /\b(pesto|mixed nuts)\b/i,
  fish: /\b(worcestershire|caesar dressing)\b/i,
  celery: /\b(stock|bouillon)\b/i,
  sulphites: /\b(wine|dried fruit)\b/i,
};

export function allergenWarnings(ingredients: string, selected: Allergen[]) {
  return selected.flatMap(allergen => ingredients.split(/\r?\n/).flatMap(line => {
    const qualifier = /\b(?:free|vegan|plant.based|dairy.alternative|substitute|or)\b/i.test(line)
      || (allergen === 'milk' && /\b(?:oat|soy|almond|coconut|rice|peanut|nut|cashew) (?:milk|cream|butter)\b/i.test(line));
    const match = explicit[allergen].test(line);
    return match || uncertain[allergen]?.test(line) ? [{ allergen, line, confirmed: match && !qualifier }] : [];
  }));
}

export function warningLabels(warnings: ReturnType<typeof allergenWarnings>) {
  return [...new Set(warnings.map(({ allergen }) =>
    `${warnings.some(match => match.allergen === allergen && match.confirmed) ? 'Contains' : 'Check for'} ${allergens[allergen].toLowerCase()}`))];
}
