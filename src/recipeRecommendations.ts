import { allergenWarnings, type Personalization, type PreferredCookingStyle } from './allergens.ts';
import { matchesDiet, type Diet, type Recipe } from './recipes.ts';

function matchesCooking(recipe: Recipe, style: PreferredCookingStyle) {
  if (style === 'quick') return Number(recipe.minutes) > 0 && Number(recipe.minutes) <= 30;
  if (style === 'onePan') return !!recipe.discovery?.onePan;
  return Number.parseInt(recipe.servings, 10) >= 4;
}

export function recipeRecommendations(recipes: Recipe[], diet: Diet, preferences?: Personalization, rank = true) {
  const options = new Set(preferences?.cooking ?? []);
  const entries = recipes.map(recipe => ({
    recipe,
    warnings: allergenWarnings(recipe.ingredients, preferences?.allergens ?? []),
    dietMatch: matchesDiet(recipe, diet),
    exactDiet: diet !== 'any' && recipe.discovery?.diet === diet,
    cookingMatches: [...options].filter(style => matchesCooking(recipe, style)).length,
  }));
  if (rank) entries.sort((a, b) => Number(!!a.warnings.length) - Number(!!b.warnings.length)
    || Number(b.dietMatch) - Number(a.dietMatch)
    || b.cookingMatches - a.cookingMatches
    || Number(b.exactDiet) - Number(a.exactDiet));
  return entries;
}
