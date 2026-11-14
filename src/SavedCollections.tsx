import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { defaultCollectionName, type NewCollection, type SavedCollection } from './collectionApi';
import { Field, Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable, Scene } from './motion';
import type { Recipe } from './recipes';
import { Action, color, Copy, Cover, font, IconButton } from './ui';

type LibraryProps = {
  collections?: SavedCollection[]; failed: boolean; retry: () => void; active: boolean;
  recipes: Recipe[]; current?: SavedCollection; openCollection: (id?: string) => void;
  openRecipe: (id: string) => void; manageRecipe: (recipe: Recipe) => void;
  create: () => void; edit: (collection: SavedCollection) => void; explore: () => void;
};

const countRecipes = (count: number) => `${count} ${count === 1 ? 'recipe' : 'recipes'}`;

export function SavedCollections({ collections, failed, retry, active, recipes, current, openCollection, openRecipe, manageRecipe, create, edit, explore }: LibraryProps) {
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const contents = current?.recipeIds.flatMap(id => byId.get(id) ?? []) ?? [];
  return <Scene trigger={active} style={styles.page}>
    <ScrollView key={current?.id ?? 'collections'} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {current && <View style={styles.top}>
        <IconButton label="Back to collections" onPress={() => openCollection()}><Glyph name="back" color={color.ink} /></IconButton>
        <IconButton label="Edit collection" onPress={() => edit(current)}><Glyph name="edit" color={color.ink} /></IconButton>
      </View>}
      <View style={styles.top}>
        <Copy accessibilityRole="header" style={styles.title}>{current?.name ?? 'Saved'}</Copy>
        {!current && collections && <IconButton label="New collection" onPress={create}><Glyph name="plus" color={color.ink} size={22} /></IconButton>}
      </View>
      <Copy style={styles.helper}>{current ? countRecipes(contents.length) : 'Your private recipe collections.'}</Copy>
      {failed && <Action secondary label="Retry collections" onPress={retry} />}
      {!collections && !failed && <Copy accessibilityLiveRegion="polite" style={styles.helper}>Opening your collections…</Copy>}
      {collections?.length === 0 && <View style={styles.empty}>
        <Glyph name="bookmark" size={28} color={color.ink} />
        <Copy style={styles.emptyTitle}>Start a collection</Copy>
        <Copy style={styles.helper}>Tap the bookmark on a recipe to start saving, or create a collection here.</Copy>
        <Action label="Explore recipes" onPress={explore} />
      </View>}
      {!current && <View style={styles.grid}>{collections?.map(collection => {
        const previews = collection.recipeIds.flatMap(id => byId.get(id) ?? []).filter(recipe => recipe.photo || recipe.cover).slice(0, 3);
        return <MotionPressable key={collection.id} accessibilityRole="button"
          accessibilityLabel={`${collection.name}, ${countRecipes(collection.recipeIds.length)}`}
          onPress={() => openCollection(collection.id)} style={styles.card}>
          <View style={styles.mosaic}>
            {previews.length > 0 ? previews.map(recipe => <View key={recipe.id} style={styles.tile}><Cover recipe={recipe} /></View>)
              : <Glyph name="book" color={color.soft} size={28} />}
          </View>
          <View style={styles.cardCopy}>
            <Copy style={styles.name}>{collection.name}</Copy>
            <Copy style={styles.helper}>{countRecipes(collection.recipeIds.length)}</Copy>
          </View>
        </MotionPressable>;
      })}</View>}
      {current && <>
        {!contents.length && <View style={styles.empty}>
          <Copy style={styles.emptyTitle}>Room for something delicious</Copy>
          <Copy style={styles.helper}>Save recipes to this collection from Explore or My recipes.</Copy>
          <Action label="Explore recipes" onPress={explore} />
        </View>}
        {contents.map(recipe => <View key={recipe.id} style={styles.recipe}>
          <MotionPressable accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}`} onPress={() => openRecipe(recipe.id)} style={styles.recipeLink}>
            <View style={styles.thumb}><Cover recipe={recipe} /></View>
            <Copy style={styles.name}>{recipe.title}</Copy>
          </MotionPressable>
          <IconButton label={`Manage collections for ${recipe.title}`} selected onPress={() => manageRecipe(recipe)}>
            <Glyph name="bookmark-filled" color={color.ink} />
          </IconButton>
        </View>)}
      </>}
    </ScrollView>
  </Scene>;
}

export function SaveToCollections({ recipe, collections, failed, retry, close, save }: {
  recipe: Recipe; collections?: SavedCollection[]; failed: boolean; retry: () => void; close: () => void;
  save: (add: string[], remove: string[], created?: NewCollection) => Promise<void>;
}) {
  if (!collections) return <Sheet title="Save to collection" close={close}>
    {failed ? <Action label="Retry collections" onPress={retry} /> : <Copy accessibilityLiveRegion="polite">Opening your collections…</Copy>}
  </Sheet>;
  return <ChooseCollections recipe={recipe} collections={collections} close={close} save={save} />;
}

function ChooseCollections({ recipe, collections, close, save }: {
  recipe: Recipe; collections: SavedCollection[]; close: () => void;
  save: (add: string[], remove: string[], created?: NewCollection) => Promise<void>;
}) {
  const [initial] = useState(() => collections.filter(collection => collection.recipeIds.includes(recipe.id)).map(collection => collection.id));
  const [selected, setSelected] = useState(initial);
  const [creating, setCreating] = useState(collections.length === 0);
  const [name, setName] = useState(collections.length === 0 ? defaultCollectionName : '');
  const [id] = useState(randomUUID);
  const { busy, error, run } = useSubmission();
  const add = selected.filter(value => !initial.includes(value));
  const remove = initial.filter(value => !selected.includes(value));
  const label = creating ? (initial.length ? 'Save changes' : 'Create and save') : initial.length ? 'Save changes' : 'Save recipe';
  return <Sheet title={initial.length ? 'Manage saved recipe' : 'Save to collection'} close={close} busy={busy}>
    <View style={styles.recipeLink}>
      <View style={styles.thumb}><Cover recipe={recipe} /></View><Copy style={styles.name}>{recipe.title}</Copy>
    </View>
    <Copy style={styles.helper}>{collections.length ? 'Choose one or more private collections.' : 'Name your first private collection.'}</Copy>
    {collections.length > 0 && <View style={styles.options}>{collections.map(collection => {
      const checked = selected.includes(collection.id);
      return <MotionPressable key={collection.id} accessibilityRole="checkbox" accessibilityState={{ checked }} disabled={busy}
        onPress={() => setSelected(previous => checked ? previous.filter(value => value !== collection.id) : [...previous, collection.id])} style={styles.option}>
        <Glyph name="book" color={color.ink} size={18} />
        <Copy style={styles.name}>{collection.name}</Copy>
        <View style={[styles.check, checked && styles.checked]}>{checked && <Glyph name="check" color={color.white} size={13} />}</View>
      </MotionPressable>;
    })}</View>}
    {creating && <Field label="Collection name" value={name} onChangeText={setName} editable={!busy} maxLength={60} placeholder="e.g. Weeknight dinners" />}
    {collections.length > 0 && <Action secondary label={creating ? 'Cancel new collection' : 'New collection'} disabled={busy} onPress={() => setCreating(!creating)}>
      <Glyph name={creating ? 'close' : 'plus'} color={color.ink} size={17} />
    </Action>}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
    <Action label={busy ? 'Saving…' : label} disabled={busy || (creating ? !name.trim() : add.length + remove.length === 0)}
      onPress={() => void run(() => save(add, remove, creating ? { id, name: name.trim() } : undefined))} />
  </Sheet>;
}

export function EditCollection({ collection, close, save, remove }: {
  collection?: SavedCollection; close: () => void; save: (id: string, name: string) => Promise<void>; remove: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(collection?.name ?? '');
  const [id] = useState(() => collection?.id ?? randomUUID());
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run, setError } = useSubmission();
  const title = confirm ? 'Delete collection?' : collection ? 'Edit collection' : 'New collection';
  return <Sheet title={title} close={close} busy={busy}>
    {confirm && collection ? <>
      <Copy>“{collection.name}” will be deleted. Recipes saved only here will leave Saved. Your own recipes stay in My recipes.</Copy>
      <Action label={busy ? 'Deleting…' : 'Delete collection'} disabled={busy} onPress={() => void run(() => remove(id))} />
      <Action secondary label="Keep collection" disabled={busy} onPress={() => { setConfirm(false); setError(''); }} />
    </> : <>
      <Field label="Collection name" value={name} onChangeText={setName} editable={!busy} maxLength={60} placeholder="e.g. Weekend cooking" />
      <Action label={busy ? 'Saving…' : collection ? 'Save changes' : 'Create collection'}
        disabled={busy || !name.trim() || name.trim() === collection?.name} onPress={() => void run(() => save(id, name.trim()))} />
      {collection && <Action secondary label="Delete collection" disabled={busy} onPress={() => { setConfirm(true); setError(''); }} />}
    </>}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
  </Sheet>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 122, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: font.bold, fontSize: 38, lineHeight: 44, letterSpacing: -1.45 },
  helper: { color: color.secondaryInk, fontSize: 14, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginTop: 8 },
  card: { width: '48.4%', borderRadius: 23, overflow: 'hidden', backgroundColor: color.muted },
  mosaic: { width: '100%', aspectRatio: 1.32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  tile: { flex: 1, height: '100%' },
  cardCopy: { padding: 13, gap: 4 },
  name: { flex: 1, minWidth: 0, fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  empty: { borderRadius: 24, backgroundColor: color.muted, padding: 20, gap: 12, marginTop: 10 },
  emptyTitle: { fontFamily: font.bold, fontSize: 21 },
  recipe: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: color.muted, padding: 8, gap: 8 },
  recipeLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 58, height: 58, borderRadius: 12, overflow: 'hidden', backgroundColor: color.muted },
  options: { backgroundColor: color.muted, borderRadius: 16 },
  option: { minHeight: 54, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.rule },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: color.ink, borderColor: color.ink },
  error: { color: color.error },
});
