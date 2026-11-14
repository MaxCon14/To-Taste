export const dietOptions = {
  any: 'No preference', vegan: 'Vegan', vegetarian: 'Vegetarian', pescatarian: 'Pescatarian',
} as const;
export type Diet = keyof typeof dietOptions;
export type RecipeDiet = Exclude<Diet, 'any'>;

export type RecipeDraft = {
  title: string;
  minutes: string;
  servings: string;
  ingredients: string;
  instructions: string;
  source?: string;
  photo?: string;
  cover?: 'pasta' | 'chicken' | 'pancakes' | 'chickpeas' | 'salmon';
};

export type Recipe = RecipeDraft & {
  id: string;
  favorite: boolean;
  discovery?: { author: string; diet?: RecipeDiet; onePan?: boolean; weekend?: boolean };
};

export const emptyDraft: RecipeDraft = {
  title: '', minutes: '', servings: '', ingredients: '', instructions: '',
};

export const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export const starterRecipes: Recipe[] = [
  {
    id: 'tomato-pasta',
    title: 'Roasted Tomato Pasta',
    minutes: '30',
    servings: '4',
    cover: 'pasta',
    favorite: false,
    ingredients: '400 g rigatoni\n500 g cherry tomatoes\n4 cloves garlic\n3 tbsp olive oil\n½ cup parmesan\n1 handful basil\nSalt and pepper, to taste',
    instructions: 'Heat the oven to 220°C / 425°F. Toss the tomatoes and garlic with olive oil and a pinch of salt, then roast until the tomatoes burst, about 20 minutes.\nCook the rigatoni according to the package directions. Reserve a mug of pasta water before draining.\nMash the roasted tomatoes and garlic. Toss with the pasta and parmesan, adding a splash of pasta water until glossy. Finish with basil and black pepper.',
  },
  {
    id: 'lemon-chicken',
    title: 'Lemon Herb Chicken',
    minutes: '25',
    servings: '2',
    cover: 'chicken',
    favorite: false,
    ingredients: '2 chicken breasts\n1 lemon\n2 cloves garlic\n2 tbsp olive oil\n1 tbsp parsley\n½ tsp salt',
    instructions: 'Pat the chicken dry. Rub with salt, minced garlic, olive oil and the zest of the lemon.\nSear in a hot skillet until golden and the thickest part reaches 74°C / 165°F.\nRest for a few minutes, then finish with lemon juice and chopped parsley.',
  },
  {
    id: 'blueberry-pancakes',
    title: 'Blueberry Pancakes',
    minutes: '20',
    servings: '3',
    cover: 'pancakes',
    favorite: false,
    ingredients: '1 cup flour\n1 tsp baking powder\n1 egg\n¾ cup milk\n2 tbsp butter\n½ cup blueberries\nMaple syrup, to serve',
    instructions: 'Whisk the flour and baking powder. In another bowl, whisk the egg, milk and melted butter.\nFold the wet mixture into the dry mixture, then fold in the blueberries. A few lumps are fine.\nCook small ladles of batter in a warm buttered skillet. Flip when bubbles appear and cook until golden. Serve with maple syrup.',
  },
];

export const featuredRecipes: Recipe[] = [
  ...starterRecipes.map((recipe): Recipe => ({
    ...recipe,
    discovery: {
      author: 'From To Taste',
      diet: recipe.id === 'blueberry-pancakes' ? 'vegetarian' : undefined,
      onePan: recipe.id === 'lemon-chicken',
      weekend: recipe.id === 'blueberry-pancakes',
    },
  })),
  {
    id: 'lemon-chickpeas',
    title: 'Lemon Chickpeas',
    minutes: '20',
    servings: '2',
    cover: 'chickpeas',
    favorite: false,
    discovery: { author: 'From To Taste', diet: 'vegan', onePan: true },
    ingredients: '1 can chickpeas, drained\n200 g cherry tomatoes\n1 lemon\n2 cloves garlic\n2 tbsp olive oil\n1 handful parsley\nSalt, to taste',
    instructions: 'Heat the olive oil in a skillet. Add the tomatoes and cook for 5 minutes until they blister.\nAdd minced garlic and the chickpeas. Stir, then simmer for 8 minutes with a splash of water.\nFinish with lemon zest, lemon juice and chopped parsley. Season with salt.',
  },
  {
    id: 'lemon-salmon',
    title: 'Lemon Salmon & Green Beans',
    minutes: '25',
    servings: '2',
    cover: 'salmon',
    favorite: false,
    discovery: { author: 'From To Taste', diet: 'pescatarian', onePan: true },
    ingredients: '2 salmon fillets\n250 g green beans, trimmed\n1 lemon\n2 tbsp olive oil\n1 handful dill\nSalt and pepper, to taste',
    instructions: 'Heat the oven to 220°C / 425°F. Toss the green beans with half the olive oil and a pinch of salt, then spread them on a sheet pan. Roast for 8 minutes.\nAdd the salmon and rub it with the remaining olive oil, lemon zest, salt and pepper. Roast until the salmon flakes and its thickest part reaches 63°C / 145°F.\nFinish with fresh dill and lemon juice.',
  },
];

export function matchesDiet(recipe: Recipe, diet: Diet) {
  if (diet === 'any') return true;
  const tag = recipe.discovery?.diet;
  return tag === 'vegan' || tag === diet || (diet === 'pescatarian' && tag === 'vegetarian');
}
