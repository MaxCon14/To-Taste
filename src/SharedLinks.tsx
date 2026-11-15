import { useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readBookRecipes } from './cookbookApi';
import { featuredRecipes, type Recipe } from './recipes';
import { readSharedBook, type RecipeBook } from './socialApi';
import { Action, color, Copy, Cover, font } from './ui';
import { Glyph } from './Glyph';

export type SharedLink = { kind: 'recipe' | 'book'; id: string };
export type SharedContent = { kind: 'recipe'; recipe: Recipe } | { kind: 'book'; book: RecipeBook; recipes: Recipe[] };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const site = 'https://pinch-recipe-preview.max-constantinou.chatgpt.site/';

export function parseSharedLink(value: unknown): SharedLink | undefined {
  if (!value || typeof value !== 'object' || !('kind' in value) || !('id' in value) || typeof value.id !== 'string') return;
  if (value.kind === 'book' && uuid.test(value.id)) return { kind: 'book', id: value.id };
  if (value.kind === 'recipe' && (uuid.test(value.id) || featuredRecipes.some(recipe => recipe.id === value.id))) {
    return { kind: 'recipe', id: value.id };
  }
}

export function sharedLinkFromUrl(url?: string | null) {
  if (!url) return;
  try {
    const query = new URL(url).searchParams;
    return parseSharedLink({ kind: 'recipe', id: query.get('recipe') })
      ?? parseSharedLink({ kind: 'book', id: query.get('book') });
  } catch { return undefined; }
}

export function recipeShareLink(recipeId: string) {
  if (recipeId.startsWith('community:')) return parseSharedLink({ kind: 'recipe', id: recipeId.slice('community:'.length) });
  if (featuredRecipes.some(recipe => recipe.id === recipeId)) return { kind: 'recipe', id: recipeId } satisfies SharedLink;
}

export async function shareLink(link: SharedLink, title: string) {
  const url = new URL(site);
  url.searchParams.set(link.kind, link.id);
  if (Platform.OS !== 'web') { await Share.share({ message: url.href }); return false; }
  if (navigator.share) {
    try { await navigator.share({ title, url: url.href }); }
    catch (cause) { if (!(cause instanceof Error && cause.name === 'AbortError')) throw cause; }
    return false;
  }
  await navigator.clipboard.writeText(url.href);
  return true;
}

export async function readSharedContent(link: SharedLink): Promise<SharedContent | null> {
  if (link.kind === 'recipe') {
    const recipe = featuredRecipes.find(item => item.id === link.id) ?? (await readBookRecipes([link.id]))[0];
    return recipe ? { kind: 'recipe', recipe } : null;
  }
  const book = await readSharedBook(link.id);
  return book ? { kind: 'book', book, recipes: await readBookRecipes(book.post_ids) } : null;
}

export function SharedPreview({ link, signIn, explore }: { link: SharedLink; signIn: () => void; explore: () => void }) {
  const [content, setContent] = useState<SharedContent | null>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setContent(undefined);
    void readSharedContent(link).then(value => { if (active) setContent(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [link, attempt]);
  const recipe = content?.kind === 'recipe' ? content.recipe : content?.recipes[0];
  const title = content?.kind === 'recipe' ? content.recipe.title : content?.book.title;
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.brand}><Glyph name="ingredients" color={color.ink} /><Copy style={styles.name}>To Taste</Copy></View>
      {recipe && <View style={styles.cover}><Cover recipe={recipe} /></View>}
      {title && <>
        <Copy accessibilityRole="header" style={styles.title}>{title}</Copy>
        {content?.kind === 'book' && content.recipes.map(item => <Copy key={item.id} style={styles.row}>{item.title}</Copy>)}
        {content?.kind === 'recipe' && <Copy style={styles.helper}>{[recipe?.discovery?.author, recipe?.minutes && `${recipe.minutes} min`].filter(Boolean).join(' · ')}</Copy>}
        <Action label={content?.kind === 'book' ? 'Sign in to open book' : 'Sign in to open recipe'} onPress={signIn} />
      </>}
      {content === null && <Copy accessibilityRole="header" style={styles.title}>This link is unavailable</Copy>}
      {failed && <Action label="Try again" onPress={() => setAttempt(value => value + 1)} />}
      {content === undefined && !failed && <Copy accessibilityLiveRegion="polite">Opening link…</Copy>}
      <Action secondary label="Explore To Taste" onPress={explore} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, gap: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  name: { fontFamily: font.bold, fontSize: 22 },
  cover: { aspectRatio: 1.16, borderRadius: 28, overflow: 'hidden' },
  title: { fontFamily: font.bold, fontSize: 35, lineHeight: 40, letterSpacing: -1 },
  helper: { color: color.secondaryInk },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.rule },
});
