import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { readBookRecipes, readCommunity, searchRecipePosts } from './cookbookApi';
import { Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { featuredRecipes, type Recipe } from './recipes';
import { saveBook, searchBooks, searchCooks, type Cook, type RecipeBook } from './socialApi';
import { Action, color, Copy, Cover, font } from './ui';

export function ExploreResults({ query, openRecipe, openBook, openCook }: {
  query: string; openRecipe: (recipe: Recipe) => void; openBook: (book: RecipeBook) => void; openCook: (cook: Cook) => void;
}) {
  const [result, setResult] = useState<{ recipes: Recipe[]; books: RecipeBook[]; cooks: Cook[]; failed: boolean }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(undefined);
    const timer = setTimeout(() => {
      void Promise.allSettled([searchRecipePosts(query), searchBooks(query), searchCooks(query)] as const)
        .then(([posts, books, cooks]) => {
          if (!active) return;
          const matches = featuredRecipes.filter(recipe => `${recipe.title}\n${recipe.ingredients}`.toLowerCase().includes(query.toLowerCase()));
          setResult({ recipes: [...matches, ...(posts.status === 'fulfilled' ? posts.value : [])],
            books: books.status === 'fulfilled' ? books.value : [], cooks: cooks.status === 'fulfilled' ? cooks.value : [],
            failed: [posts, books, cooks].some(item => item.status === 'rejected') });
        });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, attempt]);
  if (!result) return <Copy accessibilityLiveRegion="polite" style={styles.secondary}>Searching…</Copy>;
  return <View style={styles.list}>
    {result.failed && <Action secondary label="Retry unavailable results" onPress={() => setAttempt(value => value + 1)} />}
    {!result.failed && !(result.recipes.length || result.books.length || result.cooks.length) && <Copy style={styles.secondary}>No results. Try a recipe title, ingredient, or @username.</Copy>}
    {!!result.recipes.length && <View style={styles.group}>
      <Copy accessibilityRole="header" style={styles.heading}>Recipes</Copy>
      {result.recipes.map(recipe => <PostRow key={recipe.id} recipe={recipe} onPress={() => openRecipe(recipe)} />)}
    </View>}
    {!!result.books.length && <View style={styles.group}>
      <Copy accessibilityRole="header" style={styles.heading}>Recipe books</Copy>
      {result.books.map(book => <CollectionRow key={book.id} book={book} open={() => openBook(book)} />)}
    </View>}
    {!!result.cooks.length && <View style={styles.group}>
      <Copy accessibilityRole="header" style={styles.heading}>People</Copy>
      {result.cooks.map(cook => <MotionPressable key={cook.user_id} accessibilityRole="button" onPress={() => openCook(cook)} style={styles.row}>
        <View style={styles.icon}><Glyph name="profile" color={color.ink} size={21} /></View>
        <View style={styles.text}><Copy style={styles.name}>{cook.name}</Copy><Copy style={styles.secondary}>@{cook.handle}</Copy></View>
        <Glyph name="forward" color={color.secondaryInk} size={16} />
      </MotionPressable>)}
    </View>}
  </View>;
}

export function CollectionRow({ book, open }: { book: RecipeBook; open: () => void }) {
  return <MotionPressable accessibilityRole="button" onPress={open} style={styles.row}>
    <View style={styles.icon}><Glyph name="book" color={color.ink} size={21} /></View>
    <Copy style={[styles.text, styles.name]}>{book.title}</Copy><Glyph name="forward" color={color.secondaryInk} size={16} />
  </MotionPressable>;
}

export function BookSheet({ book, close, openRecipe }: { book: RecipeBook; close: () => void; openRecipe: (post: Recipe) => void }) {
  const [posts, setPosts] = useState<Recipe[]>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readBookRecipes(book.post_ids).then(value => { if (active) setPosts(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [book, attempt]);
  return <Sheet title={book.title} close={close}>
    <Copy style={styles.secondary}>Recipe book</Copy>
    {failed ? <Action secondary label="Retry book" onPress={() => { setFailed(false); setAttempt(value => value + 1); }} />
      : !posts ? <Copy style={styles.secondary}>Opening book…</Copy>
      : !posts.length ? <Copy style={styles.secondary}>This book has no currently published recipes.</Copy>
      : posts.map(post => <PostRow key={post.id} recipe={post} onPress={() => openRecipe(post)} />)}
  </Sheet>;
}

export function CreateBook({ userId, close, saved }: { userId: string; close: () => void; saved: () => void }) {
  const [posts, setPosts] = useState<Recipe[]>();
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const { busy, error, run } = useSubmission();
  useEffect(() => {
    let active = true;
    void readCommunity(userId).then(value => { if (active) setPosts(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [userId]);
  return <Sheet title="Create recipe book" close={close} busy={busy}>
    {failed ? <Copy accessibilityRole="alert">Couldn’t open your published recipes. Close and try again.</Copy>
      : !posts ? <Copy style={styles.secondary}>Loading your recipes…</Copy>
      : !posts.length ? <Copy style={styles.secondary}>Publish a recipe first, then add it to a book.</Copy> : <>
        <TextInput accessibilityLabel="Book title" placeholder="Book title" value={title} onChangeText={setTitle}
          maxLength={80} editable={!busy} style={styles.input} />
        <Copy style={styles.secondary}>Choose up to 30 published recipes · {selected.length} selected</Copy>
        {posts.map(recipe => <PostRow key={recipe.id} recipe={recipe} selected={selected.includes(recipe.id)} disabled={busy}
          onPress={() => setSelected(current => current.includes(recipe.id) ? current.filter(id => id !== recipe.id)
            : current.length < 30 ? [...current, recipe.id] : current)} />)}
        {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
        <Action label={busy ? 'Publishing…' : 'Publish book'} disabled={busy || !selected.length || !title.trim()}
          onPress={() => void run(async () => { await saveBook(title.trim(), selected.map(id => id.slice('community:'.length))); saved(); })} />
      </>}
  </Sheet>;
}

function PostRow({ recipe, onPress, selected, disabled }: { recipe: Recipe; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  return <MotionPressable accessibilityRole={selected === undefined ? 'button' : 'checkbox'} aria-checked={selected}
    disabled={disabled} onPress={onPress} style={styles.row}>
    <View style={styles.icon}><Cover recipe={recipe} /></View>
    <Copy style={[styles.text, styles.name]}>{recipe.title}</Copy>
    {selected === undefined ? <Glyph name="forward" color={color.secondaryInk} size={16} />
      : selected ? <Glyph name="check" color={color.ink} size={18} /> : <View style={styles.circle} />}
  </MotionPressable>;
}

const styles = StyleSheet.create({
  list: { gap: 24 },
  group: { gap: 8 },
  heading: { fontFamily: font.bold, fontSize: 19, marginBottom: 2 },
  row: { backgroundColor: color.muted, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 56 },
  icon: { width: 44, height: 44, borderRadius: 11, overflow: 'hidden', backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.bold, fontSize: 15 },
  secondary: { color: color.secondaryInk, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, padding: 12, borderRadius: 13, backgroundColor: color.muted, fontFamily: font.body, fontSize: 16 },
  circle: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: color.secondaryInk },
  error: { color: color.error },
});
