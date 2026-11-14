import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph } from './Glyph';
import { Action, color, Copy, Cover, Favorite, font, Segment, segmentTrack } from './ui';
import { MotionPressable as Pressable, Scene } from './motion';
import { dietOptions, lines, matchesDiet, type Diet, type Recipe } from './recipes';

export type Filter = 'all' | 'favorites';
type Props = {
  recipes: Recipe[]; filter: Filter; setFilter: (filter: Filter) => void;
  onOpen: (id: string) => void; onFavorite: (id: string) => void; onAdd: () => void;
  explore?: boolean; preference: Diet; onDiet: () => void; active: boolean;
};

export function Library({ recipes, filter, setFilter, onOpen, onFavorite, onAdd, explore = false, preference, onDiet, active }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 850;
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [collection, setCollection] = useState('All');
  const [strict, setStrict] = useState<Diet>('any');
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = Number(collection !== 'All') + Number(strict !== 'any');
  const search = query.trim().toLowerCase();
  const visible = recipes.filter((recipe) => (explore || filter === 'all' || recipe.favorite)
    && (!search || `${recipe.title}\n${recipe.ingredients}`.toLowerCase().includes(search))
    && (!explore || (matchesDiet(recipe, strict)
      && (collection !== 'Under 30 min' || (Number(recipe.minutes) > 0 && Number(recipe.minutes) < 30))
      && (collection !== 'One pan' || recipe.discovery?.onePan)
      && (collection !== 'Weekend' || recipe.discovery?.weekend))));
  if (explore) {
    const score = (recipe: Recipe) => preference !== 'any' && recipe.discovery?.diet === preference ? 2 : Number(matchesDiet(recipe, preference));
    visible.sort((a, b) => score(b) - score(a));
  }
  const filtered = Boolean(search || collection !== 'All' || strict !== 'any');
  const featured = explore && !filtered ? visible[0] : undefined;
  const rest = featured ? visible.slice(1) : visible;
  const gridWidth = Math.min(width - 40, 1120);
  const readableWidth = width / fontScale;
  const columns = readableWidth >= 1050 ? 4 : readableWidth >= 700 ? 3 : readableWidth >= 360 ? 2 : 1;
  const cardWidth = (gridWidth - (columns - 1) * (wide ? 20 : 14)) / columns;

  return <Scene trigger={active} style={styles.page}>
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><Glyph name="ingredients" color={color.white} size={17} /></View>
          <Copy style={styles.brandName}>To Taste</Copy>
        </View>
        {explore && <Pressable accessibilityRole="button" accessibilityLabel="Preferences" onPress={onDiet} style={styles.preference}>
          <Copy style={styles.preferenceLabel}>{preference === 'any' ? 'Made for you' : dietOptions[preference]}</Copy>
          <View style={styles.preferenceIcon}><Glyph name="preferences" size={17} color={color.ink} /></View>
        </Pressable>}
        {!explore && <Copy style={styles.preferenceLabel}>Your personal cookbook</Copy>}
      </View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View style={[styles.intro, wide && styles.introWide]}>
          <View style={styles.introText}>
            <Copy accessibilityRole="header" style={[styles.heading, wide && styles.headingWide]}>{explore ? 'Explore' : 'Your recipes'}</Copy>
            <Copy style={styles.subtitle}>{explore ? 'A little inspiration. Something delicious.' : 'Good food, worth keeping.'}</Copy>
          </View>
          {wide && <Copy style={styles.edition}>{explore ? 'THE EVERYDAY COLLECTION' : 'YOUR PERSONAL COLLECTION'}</Copy>}
        </View>
        <View style={styles.toolbar}>
          <View style={styles.searchRow}>
          <View testID="recipe-search" style={[styles.search, searchFocused && styles.searchFocused]}>
            <Glyph name="search" size={19} color={searchFocused ? color.ink : color.soft} />
            <TextInput value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search recipes"
              onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
              selectionColor={color.secondaryInk} cursorColor={color.ink} selectionHandleColor={color.secondaryInk}
              placeholder="Search recipes" placeholderTextColor={color.soft} style={styles.searchInput} />
            {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}>
              <Glyph name="close" size={16} color={color.soft} />
            </Pressable>}
          </View>
          {explore && <Pressable accessibilityRole="button" accessibilityLabel={activeFilters ? `Filters, ${activeFilters} active` : 'Filters'}
            accessibilityState={{ expanded: showFilters }} aria-expanded={showFilters} onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterToggle, (showFilters || activeFilters > 0) && styles.chipSelected]}>
            <Glyph name="preferences" size={20} color={showFilters || activeFilters ? color.white : color.ink} />
            {wide && <Copy style={[styles.filterToggleLabel, (showFilters || activeFilters > 0) && styles.chipSelectedText]}>Filters{activeFilters ? ` · ${activeFilters}` : ''}</Copy>}
          </Pressable>}
          </View>
          {!explore && <View style={[segmentTrack, wide && styles.wideTabs]}>
            <Segment label="My recipes" active={filter === 'all'} onPress={() => setFilter('all')} />
            <Segment label="Favorites" active={filter === 'favorites'} onPress={() => setFilter('favorites')} />
          </View>}
        </View>
        {explore && showFilters && <Scene style={styles.filterPanel}>
          <View style={styles.filterHeading}>
            <Copy accessibilityRole="header" style={styles.filterTitle}>Find your kind of recipe</Copy>
            {activeFilters > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Reset filters" onPress={() => { setCollection('All'); setStrict('any'); }} style={styles.resetFilters}><Copy style={styles.resetLabel}>Reset</Copy></Pressable>}
          </View>
          <Copy style={styles.filterSection}>Cooking mood</Copy>
          <View testID="recipe-filters" style={styles.filterGrid}>
            {['All', 'Under 30 min', 'One pan', 'Weekend'].map((name) => <Chip key={name} label={name === 'All' ? 'Any recipe' : name} selected={collection === name} onPress={() => setCollection(name)} />)}
          </View>
          <View style={styles.filterDivider} />
          <Copy style={styles.filterSection}>Diet</Copy>
          <View style={styles.filterGrid}>
            {(Object.keys(dietOptions) as Diet[]).map((diet) => <Chip key={diet} label={diet === 'any' ? 'Any diet' : dietOptions[diet]}
              selected={strict === diet} onPress={() => setStrict(diet)} />)}
          </View>
          <Action label={`Show ${visible.length} ${visible.length === 1 ? 'recipe' : 'recipes'}`} onPress={() => setShowFilters(false)} />
        </Scene>}
        {explore && !showFilters && activeFilters > 0 && <View style={styles.filterSummary}>
          <Copy style={styles.filterSummaryText}>{[collection !== 'All' ? collection : '', strict !== 'any' ? dietOptions[strict] : ''].filter(Boolean).join(' · ')}</Copy>
          <Pressable accessibilityRole="button" accessibilityLabel="Reset filters" onPress={() => { setCollection('All'); setStrict('any'); }} style={styles.resetFilters}><Copy style={styles.resetLabel}>Reset</Copy></Pressable>
        </View>}
        <Scene trigger={`${search}|${collection}|${strict}|${filter}`}>
          {featured && <View testID="recipe-card" style={[styles.feature, wide && styles.featureWide]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${featured.title}`} onPress={() => onOpen(featured.id)} style={styles.featureButton}>
              <View style={StyleSheet.absoluteFill}><Cover recipe={featured} /></View>
              <LinearGradient colors={['#08090B16', 'transparent', '#08090BBA']} locations={[0, 0.25, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.featureBadge}><Copy style={styles.featureBadgeText}>IN THE SPOTLIGHT</Copy></View>
              <View style={[styles.featureCopy, wide && styles.featureCopyWide]}>
                <Copy accessibilityRole="header" numberOfLines={4} style={[styles.featureTitle, wide && styles.featureTitleWide]}>{featured.title}</Copy>
                <View style={styles.featureFooter}>
                  <Copy style={styles.featureMeta}>{summary(featured)}</Copy>
                  <View style={styles.featureArrow}><Glyph name="forward" color={color.white} size={21} /></View>
                </View>
              </View>
            </Pressable>
            <View style={styles.featureHeart}><Favorite glass favorite={featured.favorite} onPress={() => onFavorite(featured.id)} /></View>
          </View>}
          {!!rest.length && <>
            <View style={styles.listHeader}>
              <Copy accessibilityRole="header" style={styles.listTitle}>{filtered ? 'Your matches' : explore ? 'Find your next favorite' : filter === 'favorites' ? 'Your favorites' : 'All recipes'}</Copy>
              <Copy style={styles.caption}>{rest.length} {rest.length === 1 ? 'recipe' : 'recipes'}</Copy>
            </View>
            <View style={[styles.grid, wide && styles.gridWide]}>
              {rest.map((recipe) => <View testID="recipe-card" key={recipe.id} style={[styles.card, { width: cardWidth }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`View ${recipe.title}`} onPress={() => onOpen(recipe.id)} style={styles.cardButton}>
                  <View style={[styles.cardPhoto, { height: columns === 1 ? Math.min(340, cardWidth * 0.85) : cardWidth * 1.05 }]}><Cover recipe={recipe} /></View>
                  <View style={styles.cardCopy}>
                    <Copy style={styles.cardMeta}>{summary(recipe)}</Copy>
                    <Copy style={[styles.cardTitle, wide && styles.cardTitleWide]}>{recipe.title}</Copy>
                    <Copy style={styles.author}>{recipe.discovery?.author ?? `${lines(recipe.ingredients).length} ingredients`}</Copy>
                  </View>
                </Pressable>
                <View style={styles.cardHeart}><Favorite glass favorite={recipe.favorite} onPress={() => onFavorite(recipe.id)} /></View>
              </View>)}
            </View>
          </>}
          {!visible.length && <View style={styles.empty}>
            <View style={styles.emptyIcon}><Glyph name={filter === 'favorites' && !search ? 'heart' : 'book'} size={28} color={color.ink} /></View>
            <Copy style={styles.listTitle}>{search || explore ? 'Nothing here just yet' : filter === 'favorites' ? 'Keep your favorites close' : 'A home for your recipes'}</Copy>
            <Copy style={styles.emptyCopy}>{search || explore ? 'Try another ingredient or adjust your filters.' : filter === 'favorites' ? 'Tap the heart on any recipe. Find it here whenever you need it.' : 'Start with a family favorite or a recipe you found online.'}</Copy>
            {explore && <Action secondary label="Clear filters" onPress={() => { setQuery(''); setCollection('All'); setStrict('any'); }} />}
            {!explore && filter === 'all' && !search && <Action label="Add your first recipe" onPress={onAdd}><Glyph name="plus" color={color.white} /></Action>}
          </View>}
        </Scene>
        {!!visible.length && <View style={styles.endnote}><View style={styles.endLine} /><Glyph name="ingredients" color={color.soft} size={15} /><View style={styles.endLine} /></View>}
      </View>
    </ScrollView>
  </Scene>;
}

function summary(recipe: Recipe) {
  return [recipe.minutes ? `${recipe.minutes} min` : '', recipe.discovery?.diet ? dietOptions[recipe.discovery.diet] : `${lines(recipe.ingredients).length} ingredients`].filter(Boolean).join(' · ');
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" aria-pressed={selected} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
    <Copy style={[styles.chipLabel, selected && styles.chipSelectedText]}>{label}</Copy>
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { backgroundColor: color.surface },
  headerInner: { minHeight: 76, maxWidth: 1160, paddingHorizontal: 20, width: '100%', alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 29, height: 32, borderRadius: 10, backgroundColor: color.ink, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontFamily: font.bold, fontSize: 28, letterSpacing: -1.3 },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, flexShrink: 1, minWidth: 0 },
  preferenceLabel: { color: color.soft, fontSize: 12, fontFamily: font.medium, flexShrink: 1 },
  preferenceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: color.muted },
  scroll: { alignItems: 'center', paddingBottom: 120 },
  content: { width: '100%', maxWidth: 1160, paddingHorizontal: 20 },
  intro: { paddingTop: 16, paddingBottom: 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  introWide: { paddingTop: 34, paddingBottom: 30 },
  introText: { flexShrink: 1, gap: 6 },
  heading: { fontFamily: font.bold, fontSize: 42, letterSpacing: -1.8, lineHeight: 50 },
  headingWide: { fontSize: 58, lineHeight: 65, letterSpacing: -2.5 },
  subtitle: { fontSize: 14, lineHeight: 22, color: color.soft },
  edition: { fontFamily: font.medium, fontSize: 10, letterSpacing: 1.5, color: color.soft, paddingBottom: 5 },
  caption: { color: color.soft, fontSize: 12, lineHeight: 20 },
  toolbar: { gap: 16, marginBottom: 24 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, minWidth: 0, minHeight: 50, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: color.muted, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  searchFocused: { borderColor: color.soft },
  filterToggle: { flexShrink: 0, minWidth: 50, minHeight: 50, borderRadius: 16, backgroundColor: color.muted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 15 },
  filterToggleLabel: { fontFamily: font.medium, fontSize: 13 },
  searchInput: { flex: 1, minWidth: 0, color: color.ink, fontFamily: font.body, fontSize: 14, paddingVertical: 14 },
  clear: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 40, marginRight: -10 },
  filterPanel: { borderWidth: 1, borderColor: color.rule, borderRadius: 24, padding: 18, gap: 14, marginBottom: 24, maxWidth: 560, width: '100%' },
  filterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44 },
  filterTitle: { flex: 1, fontFamily: font.bold, fontSize: 17, lineHeight: 23, letterSpacing: -0.4 },
  filterSection: { fontFamily: font.medium, color: color.soft, fontSize: 12 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterDivider: { height: 1, backgroundColor: color.rule, marginVertical: 2 },
  chip: { flexBasis: '46%', flexGrow: 1, minWidth: 0, minHeight: 46, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 12, justifyContent: 'center', backgroundColor: color.muted },
  chipSelected: { backgroundColor: color.ink },
  chipSelectedText: { color: color.white },
  chipLabel: { fontFamily: font.medium, fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: 'center' },
  resetFilters: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  resetLabel: { color: color.secondaryInk, fontFamily: font.medium, fontSize: 12 },
  filterSummary: { marginTop: -16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filterSummaryText: { flex: 1, fontSize: 12, color: color.soft },
  wideTabs: { width: 270 },
  feature: { height: 358, borderRadius: 26, overflow: 'hidden', backgroundColor: color.fill },
  featureWide: { height: 430, borderRadius: 30 },
  featureButton: { flex: 1, justifyContent: 'space-between', padding: 23 },
  featureBadge: { alignSelf: 'flex-start', backgroundColor: '#14151838', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#FFFFFF35' },
  featureBadgeText: { color: color.white, fontFamily: font.medium, fontSize: 9, letterSpacing: 1.7 },
  featureCopy: { gap: 10 },
  featureCopyWide: { padding: 12 },
  featureTitle: { color: color.white, fontFamily: font.bold, fontSize: 32, lineHeight: 36, letterSpacing: -1, maxWidth: 310 },
  featureTitleWide: { fontSize: 46, lineHeight: 50, letterSpacing: -1.8, maxWidth: 560 },
  featureFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  featureMeta: { flexShrink: 1, minWidth: 0, color: color.white, fontSize: 13, fontFamily: font.medium },
  featureHeart: { position: 'absolute', top: 15, right: 15 },
  featureArrow: { flexShrink: 0, width: 42, height: 42, borderRadius: 23, backgroundColor: '#FFFFFF20', borderWidth: 1, borderColor: '#FFFFFF66', alignItems: 'center', justifyContent: 'center' },
  listHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 30, paddingBottom: 18 },
  listTitle: { fontFamily: font.bold, fontSize: 21, lineHeight: 28, letterSpacing: -0.5, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 25 },
  gridWide: { gap: 20, rowGap: 30 },
  card: { borderRadius: 21, backgroundColor: color.surface },
  cardButton: { borderRadius: 21, overflow: 'hidden' },
  cardPhoto: { borderRadius: 21, overflow: 'hidden', backgroundColor: color.fill },
  cardCopy: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 16, gap: 5 },
  cardMeta: { color: color.soft, fontFamily: font.medium, fontSize: 10, lineHeight: 16 },
  cardTitle: { fontFamily: font.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
  cardTitleWide: { fontSize: 20, lineHeight: 25 },
  author: { fontSize: 11, color: color.soft, marginTop: 3 },
  cardHeart: { position: 'absolute', top: 10, right: 10 },
  empty: { alignItems: 'center', borderRadius: 28, backgroundColor: color.muted, paddingHorizontal: 28, paddingVertical: 50, gap: 15, marginTop: 10 },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  emptyCopy: { color: color.soft, fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 300, marginBottom: 8 },
  endnote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 40 },
  endLine: { height: 1, width: 36, backgroundColor: color.rule },
});
