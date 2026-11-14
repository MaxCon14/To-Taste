import { ScrollView, StyleSheet, View } from 'react-native';
import { Glyph } from './Glyph';
import { Scene, useScreenFocus } from './motion';
import { Action, color, Copy, font, IconButton, IngredientCard } from './ui';
import { ingredientAmount, parseIngredient } from './ingredients';
import { groupShoppingItems, type ShoppingItem } from './shopping';

export function ShoppingList({ items, onToggle, onRemove, onClearChecked, onExplore }: {
  items: ShoppingItem[];
  onToggle: (ids: ReadonlySet<string>) => void;
  onRemove: (ids: ReadonlySet<string>) => void;
  onClearChecked: () => void;
  onExplore: () => void;
}) {
  useScreenFocus('shopping-heading');
  const groups = groupShoppingItems(items);
  const checked = groups.filter(group => group.items.every(item => item.checked)).length;
  const hasChecked = items.some(item => item.checked);
  return <Scene style={styles.screen}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <Copy testID="shopping-heading" accessibilityRole="header" style={styles.title}>Shopping list</Copy>
        {items.length ? <>
          <View style={styles.summary}>
            <Copy accessibilityLiveRegion="polite" style={styles.helper}>{checked} of {groups.length} checked</Copy>
            {hasChecked && <Action secondary label="Clear checked" onPress={onClearChecked} />}
          </View>
          {groups.map(group => {
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
        </> : <View style={styles.empty}>
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
  item: { flex: 1, minWidth: 0 },
  sources: { paddingLeft: 60, gap: 4 },
  source: { color: color.secondaryInk, fontSize: 13 },
  sourceChecked: { textDecorationLine: 'line-through' },
  empty: { alignItems: 'flex-start', gap: 12, borderRadius: 24, backgroundColor: color.muted, padding: 24 },
  emptyTitle: { fontFamily: font.bold, fontSize: 20 },
});
