import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingArtwork } from './OnboardingArtwork';
import { Action, color, Copy, Cover, font } from './ui';
import { useSubmission } from './FlowSheets';
import { MotionPressable, Scene } from './motion';
import { Glyph } from './Glyph';
import { allergens, cookingStyles, readCookingPreferences, warningLabels, type Allergen, type CookingStyle, type Personalization, type PreferredCookingStyle } from './allergens';
import { recipeRecommendations } from './recipeRecommendations';
import { dietOptions, type Diet, type Recipe } from './recipes';

const allergenIcons: Record<Allergen, string> = {
  gluten: '🌾', crustaceans: '🦐', eggs: '🥚', fish: '🐟', peanuts: '🥜', soy: '🫘',
  milk: '🥛', nuts: '🌰', celery: '🥬', mustard: '🟡', sesame: '⚪', sulphites: '🍇',
  lupin: '🌱', molluscs: '🦪',
};
const dietIcons: Record<Diet, string> = { any: '🍽️', vegan: '🌱', vegetarian: '🥕', pescatarian: '🐟' };
const cookingIcons: Record<CookingStyle, string> = { any: '🍽️', quick: '⏱️', onePan: '🍳', prep: '🍱' };

function PreferenceChoice({ label, active, onPress, symbol, single = false, featured = single }: {
  label: string; active: boolean; onPress: () => void; symbol?: string; single?: boolean; featured?: boolean;
}) {
  return <MotionPressable accessibilityLabel={label} accessibilityRole={single ? 'radio' : 'checkbox'} aria-checked={active}
    onPress={onPress} style={[styles.choice, featured && styles.featureChoice, active && styles.choiceActive]}>
    <View style={styles.choiceTop}>
      <View aria-hidden style={[styles.choiceIcon, featured && styles.featureIcon]}>
        {symbol ? <Copy style={[styles.symbol, featured && styles.featureSymbol]}>{symbol}</Copy>
          : <Glyph name="check" color={color.ink} size={17} />}
      </View>
      <View style={[styles.choiceMark, active && styles.choiceMarkActive]}>
        {active && <Glyph name="check" color={color.white} size={12} />}
      </View>
    </View>
    <Copy style={[styles.choiceLabel, featured && styles.featureLabel]}>{label}</Copy>
  </MotionPressable>;
}

export function AllergenChoices({ selected, choose }: { selected: Allergen[] | null; choose: (values: Allergen[]) => void }) {
  return <View style={styles.choices}>
    <PreferenceChoice label="None" active={selected?.length === 0} onPress={() => choose([])} />
    {(Object.keys(allergens) as Allergen[]).map(item => <PreferenceChoice key={item} symbol={allergenIcons[item]}
      label={item === 'gluten' ? 'Gluten' : item === 'nuts' ? 'Nuts' : allergens[item]}
      active={selected?.includes(item) ?? false} onPress={() => {
        const values = selected ?? [];
        choose(values.includes(item) ? values.filter(value => value !== item) : [...values, item]);
      }} />)}
  </View>;
}

export function Onboarding({ accountId, signIn, initialDiet, initial, recipes, complete, edit = false, cancel }: {
  accountId?: string; signIn?: () => void; initialDiet: Diet; initial?: Personalization; recipes: Recipe[];
  complete: (diet: Diet, preferences: Personalization) => Promise<void>; edit?: boolean; cancel?: () => void;
}) {
  const [step, setStep] = useState(accountId ? 3 : 1);
  const [restored, setRestored] = useState(!accountId || edit);
  const [selected, setSelected] = useState<Allergen[] | null>(initial?.allergens ?? null);
  const [diet, setDiet] = useState<Diet | null>(edit ? initialDiet : null);
  const [cooking, setCooking] = useState<PreferredCookingStyle[] | null>(initial?.cooking ?? null);
  const { busy, error, run } = useSubmission();
  const draftKey = accountId && !edit ? `to-taste.onboarding.${accountId}` : undefined;
  useEffect(() => {
    if (!draftKey) return;
    let active = true;
    void AsyncStorage.getItem(draftKey).then(value => {
      if (!active || !value) return;
      const draft = JSON.parse(value);
      setSelected(draft.selected);
      setDiet(draft.diet);
      const restoredCooking = readCookingPreferences(draft.cooking);
      setCooking(restoredCooking);
      const lastStep = draft.version !== 2 && draft.step === 5 ? 6 : draft.step;
      setStep(lastStep === 6 && restoredCooking === null ? 5 : lastStep);
    }).catch(() => {}).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => {
    if (draftKey && restored) void AsyncStorage.setItem(draftKey, JSON.stringify({ version: 2, step, selected, diet, cooking })).catch(() => {});
  }, [draftKey, restored, step, selected, diet, cooking]);
  const visibleStep = accountId ? Math.max(3, step) : 1;
  const progress = visibleStep === 1 ? 1 : visibleStep - 1;
  const recommendations = visibleStep === 6
    ? recipeRecommendations(recipes, diet ?? 'any', { allergens: selected ?? [], cooking: cooking ?? [] }).slice(0, 3)
    : [];

  return <SafeAreaView style={styles.screen}>
    <ScrollView key={visibleStep} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Image source={require('../assets/icon.png')} style={styles.mark} />
        <Copy style={styles.brand}>To Taste</Copy>
        <Copy style={styles.progressLabel}>{progress} / 5</Copy>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${progress * 20}%` }]} /></View>
      <Scene key={visibleStep} style={styles.content}>
        {visibleStep === 1 && <>
          <View style={styles.art}><OnboardingArtwork scene="cookbook" size={290} /></View>
          <Copy accessibilityRole="header" style={styles.title}>All your recipes. Ready to cook.</Copy>
          <Copy style={styles.description}>Save the recipes you love and discover meals that suit the way you eat.</Copy>
          {signIn ? <Action label="Get started" onPress={signIn} /> : <Copy>Accounts are unavailable in this build.</Copy>}
        </>}
        {visibleStep === 3 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>What do you need to avoid?</Copy>
          <Copy style={styles.description}>Select all that apply, or choose None. We’ll flag matching ingredients. Always check product labels.</Copy>
          <AllergenChoices selected={selected} choose={setSelected} />
          <Action label="Continue" disabled={selected === null} onPress={() => setStep(4)} />
        </>}
        {visibleStep === 4 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>How do you usually eat?</Copy>
          <Copy style={styles.description}>Choose one diet preference to see more recipes that suit you.</Copy>
          <View accessibilityRole="radiogroup" accessibilityLabel="Diet" style={styles.choices}>
            {(Object.keys(dietOptions) as Diet[]).map(item => <PreferenceChoice single key={item}
              label={dietOptions[item]} symbol={dietIcons[item]} active={diet === item} onPress={() => setDiet(item)} />)}
          </View>
          <Action label="Continue" disabled={diet === null} onPress={() => setStep(5)} />
        </>}
        {visibleStep === 5 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>What do you like to cook?</Copy>
          <Copy style={styles.description}>Select all the meals you’d like to see more often, or choose No preference.</Copy>
          <View style={styles.choices}>{(Object.keys(cookingStyles) as CookingStyle[]).map(item =>
            <PreferenceChoice featured key={item} label={cookingStyles[item]} symbol={cookingIcons[item]}
              active={item === 'any' ? cooking?.length === 0 : cooking?.includes(item) ?? false}
              onPress={() => setCooking(current => {
                if (item === 'any') return [];
                const choices = current ?? [];
                return choices.includes(item) ? choices.filter(choice => choice !== item) : [...choices, item];
              })} />)}</View>
          <Action label="See your recommendations" disabled={cooking === null} onPress={() => setStep(6)} />
        </>}
        {visibleStep === 6 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>Your first recipes.</Copy>
          <Copy style={styles.description}>A few ideas to get you cooking. Check the full ingredient list before you start.</Copy>
          {recommendations.map(({ recipe, warnings }) => <View style={styles.recipe} key={recipe.id}>
            <View style={styles.cover}><Cover recipe={recipe} /></View>
            <View style={styles.recipeCopy}><Copy style={styles.recipeTitle}>{recipe.title}</Copy>
              {warningLabels(warnings).map(label => <Copy style={styles.warning} key={label}>{label}</Copy>)}
            </View>
          </View>)}
          <Action label={busy ? 'Saving…' : 'Open Explore'} disabled={busy} onPress={() => void run(async () => {
            if (selected !== null && diet !== null && cooking !== null) {
              await complete(diet, { allergens: selected, cooking });
              if (draftKey) void AsyncStorage.removeItem(draftKey).catch(() => {});
            }
          })} />
        </>}
        {error ? <Copy accessibilityRole="alert" style={styles.warning}>{error}</Copy> : null}
        {!restored && <Copy accessibilityLiveRegion="polite">Opening your preferences…</Copy>}
        {visibleStep > 3 && <Action secondary label="Back" disabled={busy} onPress={() => setStep(visibleStep - 1)} />}
        {cancel && <Action secondary label="Cancel edits" disabled={busy} onPress={cancel} />}
      </Scene>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  scroll: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 24, paddingBottom: 42 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11 },
  brand: { fontFamily: font.bold, fontSize: 26, flex: 1, letterSpacing: -1 },
  progressLabel: { color: color.secondaryInk, fontFamily: font.medium, fontSize: 13 },
  track: { height: 4, overflow: 'hidden', backgroundColor: color.rule, borderRadius: 4, marginTop: 16 },
  fill: { height: '100%', backgroundColor: color.ink },
  content: { gap: 16, paddingTop: 26 },
  title: { fontFamily: font.bold, fontSize: 36, lineHeight: 41, letterSpacing: -1.6 },
  description: { fontSize: 16, lineHeight: 24, color: color.secondaryInk },
  art: { alignItems: 'center', overflow: 'hidden' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  choice: { width: '49%', minHeight: 76, padding: 10, gap: 7, borderWidth: 1, borderColor: color.rule, backgroundColor: color.surface, borderRadius: 16 },
  featureChoice: { minHeight: 118, padding: 14, gap: 12, borderRadius: 20 },
  choiceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  choiceIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: color.muted, alignItems: 'center', justifyContent: 'center' },
  featureIcon: { width: 46, height: 46, borderRadius: 14 },
  symbol: { fontSize: 17 },
  featureSymbol: { fontSize: 26 },
  choiceActive: { borderColor: color.ink, backgroundColor: color.muted },
  choiceLabel: { fontFamily: font.medium, fontSize: 14, lineHeight: 19 },
  featureLabel: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  choiceMark: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  choiceMarkActive: { borderColor: color.ink, backgroundColor: color.ink },
  recipe: { flexDirection: 'row', backgroundColor: color.muted, borderRadius: 20, overflow: 'hidden', minHeight: 86 },
  cover: { width: 86 },
  recipeCopy: { flex: 1, padding: 12, justifyContent: 'center', gap: 5 },
  recipeTitle: { fontFamily: font.bold, fontSize: 17 },
  warning: { color: color.error, fontFamily: font.medium },
});
