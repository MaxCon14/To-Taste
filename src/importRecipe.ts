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

export function isSocialRecipeLink(input: string): boolean {
  try {
    const host = new URL(normalizeRecipeUrl(input)).hostname;
    return /(?:^|\.)(?:tiktok\.com|instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|pinterest\.com|pin\.it|threads\.net|threads\.com|x\.com|twitter\.com|snapchat\.com|vimeo\.com)$/.test(host);
  } catch {
    return false;
  }
}

export function recipeFromCaption(caption: string, source: string): RecipeDraft | undefined {
  let section: 'ingredients' | 'instructions' | undefined;
  let title = '';
  const ingredients: string[] = [];
  const instructions: string[] = [];
  for (const raw of caption.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^(?:[^\p{L}\p{N}]*)?(ingredients|what you(?:’|')ll need|directions|instructions|steps|method|how to make it)\s*[:：]?\s*$/iu);
    if (heading) {
      section = /ingredients|need/i.test(heading[1]) ? 'ingredients' : 'instructions';
      continue;
    }
    if (/^(?:#|@|follow\b|save (?:this|for)\b|(?:notes|tips|nutrition|servings|credits)\s*[:：]?$)/i.test(line)) {
      section = undefined;
      continue;
    }
    if (section === 'ingredients') ingredients.push(line.replace(/^[-•*]\s+/, ''));
    else if (section === 'instructions') instructions.push(line.replace(/^(?:[-•*]|\d+[.)])\s+/, ''));
    else if (!title && !ingredients.length && !instructions.length) title = line.slice(0, 120);
  }
  if (!ingredients.length && !instructions.length) return;
  return { ...emptyDraft, title, ingredients: ingredients.join('\n'), instructions: instructions.join('\n'), source };
}

function socialCaptionFromHtml(html: string): string {
  const metadata = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    const attrs = Object.fromEntries([...tag.matchAll(/\b([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, key, double, single]) => [key.toLowerCase(), double ?? single]));
    const property = attrs.property ?? attrs.name;
    if (property && attrs.content) metadata.set(property, attrs.content);
  }
  const caption = metadata.get('og:description') ?? metadata.get('twitter:description') ?? metadata.get('description') ?? '';
  return entities.decode(caption);
}

export async function importRecipe(input: string, web: boolean, cloud?: { endpoint: string; token: string; key: string }): Promise<RecipeDraft> {
  const url = normalizeRecipeUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(cloud ? cloud.endpoint : web ? `/api/import?url=${encodeURIComponent(url)}` : url, {
      signal: controller.signal,
      ...(cloud && { method: 'POST', body: url }),
      headers: cloud ? { Authorization: `Bearer ${cloud.token}`, apikey: cloud.key, 'Content-Type': 'text/plain' }
        : { Accept: web ? 'application/json' : 'text/html' },
    });
    if (!response.ok) throw new Error();
    const page = cloud || web ? await response.json() as { html: string; url: string }
      : { html: await response.text(), url: response.url || url };
    const recipe = recipeFromHtml(page.html, page.url)
      ?? (isSocialRecipeLink(url) ? recipeFromCaption(socialCaptionFromHtml(page.html), url) : undefined);
    if (recipe) return recipe;
  } catch {
    if (isSocialRecipeLink(url)) throw new Error('To Taste couldn’t read the caption from this link. Paste the caption or transcript to continue.');
    throw new Error('To Taste couldn’t read that page. Check the link or enter the recipe by hand.');
  } finally {
    clearTimeout(timeout);
  }
  if (isSocialRecipeLink(url)) throw new Error('The caption didn’t contain a readable ingredient list or directions. Paste the recipe text or write it and keep the link.');
  throw new Error('To Taste couldn’t find recipe ingredients on that page. Try another link or enter the recipe by hand.');
}
