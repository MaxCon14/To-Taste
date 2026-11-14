import { useRef, useState } from 'react';
import { Animated, Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionPressable as Pressable, Scene, useSceneMotion, useScreenFocus } from './motion';
import { Glyph } from './Glyph';
import { CookMode, type CookingTimer } from './CookMode';
import { Sheet, useSubmission } from './FlowSheets';
import { dietOptions, lines, type Recipe } from './recipes';
import { Action, color, Copy, Cover, Favorite, font, IconButton, IngredientCard, RecipeFacts, Segment, segmentTrack } from './ui';

export function RecipeScreen({ recipe, onBack, onEdit, onFavorite, onShare, onSave, onRemove, onAddIngredients }: {
  recipe: Recipe; onBack: () => void; onEdit?: () => void; onFavorite: () => void; onShare?: () => void; onSave?: () => void; onRemove?: () => void;
  onAddIngredients: (indices: number[]) => Promise<void>;
}) {
  const motion = useSceneMotion(recipe.id, 24);
  useScreenFocus('recipe-title');
  const [prepared, setPrepared] = useState<number[]>([]);
  const [shoppingSelection, setShoppingSelection] = useState<number[] | null>(null);
  const shoppingSubmission = useSubmission();
  const [section, setSection] = useState<'ingredients' | 'directions'>('ingredients');
  const [sourceError, setSourceError] = useState(false);
  const [photoBehindStatus, setPhotoBehindStatus] = useState(true);
  const [cooking, setCooking] = useState(false);
  const [cookStep, setCookStep] = useState(0);
  const [timer, setTimer] = useState<CookingTimer>();
  const photoBehindStatusRef = useRef(true);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 760;
  const hasPhoto = Boolean(recipe.cover || recipe.photo);
  const heroHeight = hasPhoto ? wide ? 487 : Math.max(355, Math.min(490, height * 0.53)) : wide ? 300 : 255;
  const ingredients = lines(recipe.ingredients);
  const instructions = lines(recipe.instructions);
  const showingIngredients = section === 'ingredients';
  const selectedCount = shoppingSelection?.length ?? 0;
  const addLabel = selectedCount === 0 ? 'Add ingredients' : `Add ${selectedCount} ingredient${selectedCount === 1 ? '' : 's'}`;

  return <Animated.View style={[styles.page, motion.style]}>
    <StatusBar style={hasPhoto && photoBehindStatus ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={wide}
      onScroll={(event) => {
        const photoVisible = event.nativeEvent.contentOffset.y < heroHeight;
        if (photoVisible !== photoBehindStatusRef.current) {
          photoBehindStatusRef.current = photoVisible;
          setPhotoBehindStatus(photoVisible);
        }
      }} scrollEventThrottle={32}>
      <View style={[styles.content, wide && styles.wide]}>
        <View style={[styles.hero, { minHeight: heroHeight + insets.top }, wide && styles.heroWide, !hasPhoto && styles.heroPlain]}>
          {hasPhoto ? <>
            <View style={StyleSheet.absoluteFill}><Cover recipe={recipe} /></View>
            <LinearGradient colors={['#10111450', 'transparent', '#10111440', '#101114ED']} locations={[0, 0.28, 0.57, 1]} style={StyleSheet.absoluteFill} />
          </> : <View style={[styles.plainCover, { top: 26 + insets.top }]}><Cover recipe={recipe} /></View>}
          <View style={[styles.top, { paddingTop: 15 + insets.top }]}>
            <IconButton label="Back to recipes" glass={hasPhoto} onPress={() => motion.exit(onBack)}>
              <Glyph name="back" color={hasPhoto ? color.white : color.ink} size={17} />
            </IconButton>
            <View style={styles.actions}>
              {onEdit && <IconButton label="Edit" glass={hasPhoto} onPress={onEdit}>
                <Glyph name="edit" color={hasPhoto ? color.white : color.ink} size={18} />
              </IconButton>}
              <Favorite glass={hasPhoto} favorite={recipe.favorite} onPress={onFavorite} />
            </View>
          </View>
          <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
            <Copy testID="recipe-title" accessibilityRole="header" style={[styles.title, wide && styles.titleWide, hasPhoto && styles.titleOnPhoto]}>{recipe.title}</Copy>
            {recipe.discovery && <Copy style={{ color: hasPhoto ? color.white : color.secondaryInk }}>{recipe.discovery.author}{recipe.discovery.diet ? ` · ${dietOptions[recipe.discovery.diet]}` : ''}</Copy>}
            <RecipeFacts recipe={recipe} overPhoto={hasPhoto} />
          </View>
        </View>
        <View style={[styles.body, wide && styles.bodyWide]}>
          {onSave && <Action secondary label="Save to recipe book" onPress={onSave}><Glyph name="book" color={color.ink} /></Action>}
          <View style={[segmentTrack, wide && styles.tabsWide]}>
            <Segment label="Ingredients" active={showingIngredients} onPress={() => setSection('ingredients')} />
            <Segment label="Directions" active={!showingIngredients} onPress={() => setSection('directions')} />
          </View>
          <Scene trigger={section}>{showingIngredients ? <View>
            <View style={styles.sectionTop}>
              <Copy accessibilityRole="header" style={styles.heading}>Ingredients</Copy>
            </View>
            {ingredients.map((line, index) => <IngredientCard key={index} line={line} />)}
            {ingredients.length > 0 && <Action secondary label="Add to shopping list" onPress={() => {
              shoppingSubmission.setError('');
              setShoppingSelection([]);
            }} style={[styles.wideAction, styles.shoppingAction]}>
              <Glyph name="shopping" color={color.ink} />
            </Action>}
          </View> : <View>
            <View style={styles.sectionTop}><Copy accessibilityRole="header" style={styles.heading}>Directions</Copy></View>
            {instructions.length ? instructions.map((instruction, index) => <View style={styles.step} key={index}>
              <View style={styles.number}><Copy style={styles.numberText}>{index + 1}</Copy></View>
              <Copy style={styles.stepText}>{instruction}</Copy>
            </View>) : <Copy style={styles.stepText}>No directions saved.</Copy>}
          </View>}</Scene>
          {!!recipe.source && <Pressable accessibilityRole="link" style={styles.source} onPress={() => {
            setSourceError(false);
            void Linking.openURL(recipe.source!).catch(() => setSourceError(true));
          }}><Copy style={styles.sourceText}>Original recipe</Copy><Glyph name="external" color={color.secondaryInk} size={15} /></Pressable>}
          {sourceError && <Copy accessibilityRole="alert" style={styles.sourceText}>Couldn’t open the original recipe.</Copy>}
          {onShare && <Action secondary label="Share with the community" onPress={onShare}><Glyph name="share" color={color.ink} /></Action>}
          {onRemove && <Action secondary label="Remove from recipe book" onPress={onRemove} />}
        </View>
      </View>
    </ScrollView>
    {instructions.length > 0 && <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <Action style={[styles.wideAction, styles.dockAction]} label={cookStep > 0 || timer ? 'Resume cooking' : 'Start cooking'} onPress={() => setCooking(true)}>
        <Glyph name="forward" color={color.white} size={17} />
      </Action>
    </View>}
    {shoppingSelection !== null && <Sheet title="What do you need to buy?" busy={shoppingSubmission.busy} close={() => setShoppingSelection(null)}>
      <Copy style={styles.sourceText}>Leave anything you already have unchecked.</Copy>
      <View style={styles.sectionTop}>
        <Copy accessibilityLiveRegion="polite" style={styles.progress}>{shoppingSelection.length} selected</Copy>
        <Action secondary disabled={shoppingSubmission.busy}
          label={shoppingSelection.length === ingredients.length ? 'Clear selection' : 'Select all'}
          onPress={() => setShoppingSelection(shoppingSelection.length === ingredients.length ? [] : ingredients.map((_, index) => index))} />
      </View>
      <View>
        {ingredients.map((line, index) => <IngredientCard key={index} line={line} strikeChecked={false}
          checked={shoppingSelection.includes(index)} toggle={() => {
            if (shoppingSubmission.busy) return;
            setShoppingSelection(current => current?.includes(index)
              ? current.filter(item => item !== index) : [...(current ?? []), index]);
          }} />)}
      </View>
      {shoppingSubmission.error ? <Copy accessibilityRole="alert">{shoppingSubmission.error}</Copy> : null}
      <Action label={shoppingSubmission.busy ? 'Adding…' : addLabel}
        disabled={shoppingSubmission.busy || !shoppingSelection.length} onPress={() => void shoppingSubmission.run(async () => {
          await onAddIngredients(shoppingSelection);
          setShoppingSelection(null);
        })} />
    </Sheet>}
    {cooking && <CookMode recipe={recipe} stepIndex={cookStep} setStep={setCookStep} timer={timer} setTimer={setTimer}
      prepared={prepared} onTogglePrepared={index => setPrepared(current => current.includes(index)
        ? current.filter(item => item !== index) : [...current, index])}
      close={() => setCooking(false)} />}
  </Animated.View>;
}

const styles = StyleSheet.create({
  wideAction: { width: '100%', maxWidth: 440, minHeight: 58, alignSelf: 'center' },
  shoppingAction: { marginTop: 18 },
  page: { flex: 1, backgroundColor: color.surface },
  scroll: { alignItems: 'center', paddingBottom: 115 },
  content: { maxWidth: 1000, width: '100%' },
  wide: { paddingHorizontal: 24, paddingTop: 24 },
  hero: { backgroundColor: '#23262B', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', justifyContent: 'space-between' },
  heroWide: { borderRadius: 32 },
  heroPlain: { backgroundColor: color.fill },
  plainCover: { position: 'absolute', height: 112, left: 0, right: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 17, gap: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCopy: { alignItems: 'flex-start', gap: 17, paddingHorizontal: 25, paddingBottom: 28 },
  heroCopyWide: { maxWidth: 860, width: '100%', alignSelf: 'center', paddingBottom: 26 },
  title: { fontFamily: font.display, fontSize: 34, lineHeight: 39, letterSpacing: -1.3 },
  titleWide: { fontSize: 52, lineHeight: 57 },
  titleOnPhoto: { color: color.white, textShadowColor: '#11131840', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  body: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 22, gap: 24 },
  bodyWide: { paddingHorizontal: 34, paddingTop: 22 },
  tabsWide: { width: 340 },
  sectionTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 7, marginBottom: 3 },
  heading: { fontFamily: font.display, fontSize: 25, letterSpacing: -0.7 },
  progress: { color: color.soft, fontFamily: font.medium, fontSize: 12 },
  step: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 13, borderBottomWidth: 1, borderColor: color.rule },
  number: { height: 29, width: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: color.fill },
  numberText: { color: color.secondaryInk, fontFamily: font.bold, fontSize: 13 },
  stepText: { flex: 1, color: color.ink, lineHeight: 23, paddingTop: 2 },
  source: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start' },
  sourceText: { color: color.secondaryInk, fontFamily: font.medium, fontSize: 14 },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, alignItems: 'center' },
  dockAction: { shadowColor: '#111318', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 8 }, shadowRadius: 22 },
});
