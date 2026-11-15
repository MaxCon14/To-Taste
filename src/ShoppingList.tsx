import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Glyph } from './Glyph';
import { Scene, useScreenFocus } from './motion';
import { Action, color, Copy, font, IconButton, IngredientCard, Segment, segmentTrack } from './ui';
import { ingredientAmount, parseIngredient } from './ingredients';
import { groupShoppingByRecipe, groupShoppingItems, type ShoppingItem } from './shopping';

export function ShoppingList({ items, onToggle, onRemove, onClearChecked, onExplore, status, retry, onImport }: {
  items: ShoppingItem[];
  onToggle: (ids: ReadonlySet<string>) => void;
  onRemove: (ids: ReadonlySet<string>) => void;
  onClearChecked: () => void;
  onExplore: () => void;
  status: 'loading' | 'ready' | 'error';
  retry: () => void;
  onImport?: () => void;
}) {
  useScreenFocus('shopping-heading');
  const [view, setView] = useState<'recipe' | 'ingredient'>('recipe');
  const byRecipe = view === 'recipe';
  const groups = byRecipe ? groupShoppingByRecipe(items) : groupShoppingItems(items);
  const total = byRecipe ? items.length : groups.length;
  const checked = byRecipe ? items.filter(item => item.checked).length
    : groups.filter(group => group.items.every(item => item.checked)).length;
  const hasChecked = items.some(item => item.checked);
  return <Scene style={styles.screen}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <Copy testID="shopping-heading" accessibilityRole="header" style={styles.title}>Shopping list</Copy>
        {onImport && <Action secondary label="Import this device’s old list" onPress={onImport} />}
        {status === 'loading' && <Copy accessibilityLiveRegion="polite" style={styles.helper}>Opening your list…</Copy>}
        {status === 'error' && <Action secondary label="Retry shopping list" onPress={retry} />}
        {items.length > 0 ? <>
          <View style={segmentTrack}>
            <Segment label="By recipe" active={byRecipe} onPress={() => setView('recipe')} />
            <Segment label="By ingredient" active={!byRecipe} onPress={() => setView('ingredient')} />
          </View>
          <View style={styles.summary}>
            <Copy accessibilityLiveRegion="polite" style={styles.helper}>{checked} of {total} checked</Copy>
            {hasChecked && <Action secondary label="Clear checked" onPress={onClearChecked} />}
          </View>
          {byRecipe ? groups.map(recipe => <View key={recipe.key} style={styles.recipeSection}>
            <View style={styles.recipeHeader}>
              <Glyph name="book" color={color.secondaryInk} size={18} />
              <Copy accessibilityRole="header" style={styles.recipeTitle}>{recipe.name}</Copy>
            </View>
            {recipe.items.map(item => {
              const ids = new Set([item.id]);
              return <View key={item.id} style={styles.row}>
                <View style={styles.item}>
                  <IngredientCard line={item.line} checked={item.checked} toggle={() => onToggle(ids)} />
                </View>
                <IconButton label={`Remove ${item.line} from ${recipe.name}`} onPress={() => onRemove(ids)}>
                  <Glyph name="trash" color={color.secondaryInk} size={16} />
                </IconButton>
              </View>;
            })}
          </View>) : groups.map(group => {
            const ids = new Set(group.items.map(item => item.id));
            const complete = group.items.every(item => item.checked);
            const shared = group.items.length > 1;
            return <View key={group.key} style={styles.group}>
              <View style={styles.row}>
                <View style={styles.item}>
                  <IngredientCard line={shared ? group.name : group.items[0].line}
                    checked={complete} toggle={() => onToggle(ids)} />
                </View>
                <IconButton label={`Remove ${group.name} from shopping list`} onPress={() => onRemove(ids)}>
                  <Glyph name="trash" color={color.secondaryInk} size={16} />
                </IconButton>
              </View>
              <View style={styles.sources}>
                {group.items.map(item => {
                  const amount = shared ? ingredientAmount(parseIngredient(item.line)) : '';
                  return <Copy key={item.id} style={[styles.source, item.checked && styles.sourceChecked]}>
                    {item.recipe}{amount ? ` · ${amount}` : ''}
                  </Copy>;
                })}
              </View>
            </View>
          })}
        </> : status === 'ready' && <View style={styles.empty}>
          <Glyph name="shopping" color={color.ink} size={30} />
          <Copy style={styles.emptyTitle}>Your list is empty</Copy>
          <Copy style={styles.helper}>Open a recipe to add its ingredients here.</Copy>
          <Action label="Explore recipes" onPress={onExplore} />
        </View>}
      </View>
    </ScrollView>
  </Scene>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 22, paddingTop: 36, paddingBottom: 120, alignItems: 'center' },
  content: { width: '100%', maxWidth: 560, gap: 16 },
  title: { fontFamily: font.display, fontSize: 36, letterSpacing: -1.4 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  helper: { color: color.secondaryInk, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  group: { gap: 8 },
  recipeSection: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.rule, borderRadius: 22, padding: 12 },
  recipeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginBottom: 4, backgroundColor: color.muted, borderRadius: 12 },
  recipeTitle: { flex: 1, fontFamily: font.bold, fontSize: 17 },
  item: { flex: 1, minWidth: 0 },
  sources: { paddingLeft: 60, gap: 4 },
  source: { color: color.secondaryInk, fontSize: 13 },
  sourceChecked: { textDecorationLine: 'line-through' },
  empty: { alignItems: 'flex-start', gap: 12, borderRadius: 24, backgroundColor: color.muted, padding: 24 },
  emptyTitle: { fontFamily: font.bold, fontSize: 20 },
});
