import entities from 'he';
import { emptyDraft, type RecipeDraft } from './recipes.ts';

type Data = Record<string, unknown>;
const record = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value);
const items = (value: unknown): unknown[] => Array.isArray(value) ? value : [value];
const clean = (value: unknown) => typeof value === 'string'
  ? entities.decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
  : '';

function* recipeObjects(value: unknown): Generator<Data> {
  if (Array.isArray(value)) {
    for (const item of value) yield* recipeObjects(item);
  } else if (record(value)) {
    if (items(value['@type']).some((type) => typeof type === 'string' && /(?:^|[/#:])Recipe$/i.test(type))) yield value;
    for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage']) yield* recipeObjects(value[key]);
  }
}

function steps(value: unknown): string[] {
  return items(value).flatMap((item) => {
    if (typeof item === 'string') return item.split(/\r?\n|<\/p>|<br\s*\/?\s*>/i).map(clean).filter(Boolean);
    if (!record(item)) return [];
    if (item.itemListElement) return steps(item.itemListElement);
    return steps(item.text ?? item.name);
  });
}

function photoUrl(value: unknown, page: string): string | undefined {
  for (const item of items(value)) {
    const raw = typeof item === 'string' ? item : record(item) ? clean(item.url ?? item.contentUrl) : '';
    if (!raw) continue;
    try {
      const url = new URL(raw, page);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch {
      // A cover is optional when a site has no usable image.
    }
  }
}

function totalMinutes(value: unknown): number {
  const match = typeof value === 'string' && value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  return match ? 1440 * Number(match[1] || 0) + 60 * Number(match[2] || 0) + Number(match[3] || 0) + Math.ceil(Number(match[4] || 0) / 60) : 0;
}

export function recipeFromHtml(html: string, source: string): RecipeDraft | undefined {
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi);
  for (const [, attrs, body] of scripts) {
    if (!/\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json(?=\s|$))/i.test(attrs)) continue;
    let value: unknown;
    try {
      value = JSON.parse(body.trim().replace(/^<!--\s*|\s*-->$/g, ''));
    } catch {
      continue;
    }
    for (const recipe of recipeObjects(value)) {
      const title = clean(recipe.name);
      const ingredients = items(recipe.recipeIngredient).map(clean).filter(Boolean);
      if (!title || !ingredients.length) continue;
      const minutes = totalMinutes(recipe.totalTime) || totalMinutes(recipe.prepTime) + totalMinutes(recipe.cookTime);
      const servings = items(recipe.recipeYield).map((yieldValue) =>
        typeof yieldValue === 'number' ? String(yieldValue) : clean(yieldValue)
      ).find(Boolean) ?? '';
      return {
        ...emptyDraft,
        title,
        ingredients: ingredients.join('\n'),
        instructions: steps(recipe.recipeInstructions).join('\n'),
        minutes: minutes ? String(minutes) : '',
        servings,
        source,
        photo: photoUrl(recipe.image, source),
      };
    }
  }
}

export function normalizeRecipeUrl(input: string): string {
  try {
    const trimmed = input.trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error();
    url.protocol = 'https:';
    url.hash = '';
    return url.href;
  } catch {
    throw new Error('Enter a recipe link, such as https://example.com/my-recipe.');
  }
}

export async function importRecipe(input: string, web: boolean): Promise<RecipeDraft> {
  const url = normalizeRecipeUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(web ? `/api/import?url=${encodeURIComponent(url)}` : url, {
      signal: controller.signal,
      headers: { Accept: web ? 'application/json' : 'text/html' },
    });
    if (!response.ok) throw new Error();
    const page = web ? await response.json() as { html: string; url: string }
      : { html: await response.text(), url: response.url || url };
    const recipe = recipeFromHtml(page.html, page.url);
    if (recipe) return recipe;
  } catch {
    throw new Error('To Taste couldn’t read that page. Check the link or enter the recipe by hand.');
  } finally {
    clearTimeout(timeout);
  }
  throw new Error('To Taste couldn’t find recipe ingredients on that page. Try another link or enter the recipe by hand.');
}
