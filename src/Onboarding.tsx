import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingArtwork } from './OnboardingArtwork';
import { Action, color, Copy, Cover, font, Segment } from './ui';
import { DietChoices, useSubmission } from './FlowSheets';
import { Scene } from './motion';
import { allergens, allergenWarnings, cookingStyles, warningLabels, type Allergen, type CookingStyle, type Personalization } from './allergens';
import type { Diet, Recipe } from './recipes';

export function AllergenChoices({ selected, choose }: { selected: Allergen[] | null; choose: (values: Allergen[]) => void }) {
  return <View style={styles.choices}>
    <Segment label="No allergies" active={selected?.length === 0} onPress={() => choose([])} />
    {(Object.keys(allergens) as Allergen[]).map(item => <Segment key={item} label={allergens[item]}
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
  const [cooking, setCooking] = useState<CookingStyle | null>(initial?.cooking ?? null);
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
      setCooking(draft.cooking);
      setStep(draft.step);
    }).catch(() => {}).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => {
    if (draftKey && restored) void AsyncStorage.setItem(draftKey, JSON.stringify({ step, selected, diet, cooking })).catch(() => {});
  }, [draftKey, restored, step, selected, diet, cooking]);
  const visibleStep = accountId ? Math.max(3, step) : Math.min(2, step);
  const recommendations = recipes.map(recipe => ({ recipe, warnings: allergenWarnings(recipe.ingredients, selected ?? []) }))
    .sort((a, b) => Number(!!a.warnings.length) - Number(!!b.warnings.length)
      || Number(b.recipe.discovery?.diet === diet) - Number(a.recipe.discovery?.diet === diet)
      || Number(matchesCooking(b.recipe, cooking)) - Number(matchesCooking(a.recipe, cooking))).slice(0, 3);

  return <SafeAreaView style={styles.screen}>
    <ScrollView key={visibleStep} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Image source={require('../assets/icon.png')} style={styles.mark} />
        <Copy style={styles.brand}>To Taste</Copy>
        <Copy style={styles.progressLabel}>{visibleStep} / 5</Copy>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${visibleStep * 20}%` }]} /></View>
      <Scene key={visibleStep} style={styles.content}>
        {visibleStep === 1 && <>
          <View style={styles.art}><OnboardingArtwork scene="cookbook" size={290} /></View>
          <Copy accessibilityRole="header" style={styles.title}>All your recipes. Ready to cook.</Copy>
          <Copy style={styles.description}>Save the recipes you love and discover meals that suit the way you eat.</Copy>
          <Action label="Get started" onPress={() => setStep(2)} />
          {signIn && <Action secondary label="Sign in" onPress={signIn} />}
        </>}
        {visibleStep === 2 && <>
          <Copy accessibilityRole="header" style={styles.title}>Make it yours.</Copy>
          <Copy style={styles.description}>Create an account to save your cookbook and carry your preferences across devices.</Copy>
          {signIn ? <Action label="Create account or sign in" onPress={signIn} /> : <Copy>Accounts are unavailable in this build.</Copy>}
        </>}
        {visibleStep === 3 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>What do you need to avoid?</Copy>
          <Copy style={styles.description}>Choose your allergens and we’ll flag matching ingredients. Always check ingredients and product labels.</Copy>
          <AllergenChoices selected={selected} choose={setSelected} />
          <Action label="Continue" disabled={selected === null} onPress={() => setStep(4)} />
        </>}
        {visibleStep === 4 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>How do you like to cook?</Copy>
          <DietChoices selected={diet} setDiet={setDiet} />
          <View style={styles.choices}>{(Object.keys(cookingStyles) as CookingStyle[]).map(item =>
            <Segment key={item} label={cookingStyles[item]} active={cooking === item} onPress={() => setCooking(item)} />)}</View>
          <Action label="See your recommendations" disabled={diet === null || cooking === null} onPress={() => setStep(5)} />
        </>}
        {visibleStep === 5 && restored && <>
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
        {(visibleStep === 2 || visibleStep > 3) && <Action secondary label="Back" disabled={busy} onPress={() => setStep(visibleStep - 1)} />}
        {cancel && <Action secondary label="Cancel edits" disabled={busy} onPress={cancel} />}
      </Scene>
    </ScrollView>
  </SafeAreaView>;
}

export function matchesCooking(recipe: Recipe, cooking?: CookingStyle | null) {
  if (cooking === 'quick') return Number(recipe.minutes) > 0 && Number(recipe.minutes) <= 30;
  if (cooking === 'onePan') return !!recipe.discovery?.onePan;
  if (cooking === 'prep') return Number.parseInt(recipe.servings, 10) >= 4;
  return false;
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
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  recipe: { flexDirection: 'row', backgroundColor: color.muted, borderRadius: 20, overflow: 'hidden', minHeight: 86 },
  cover: { width: 86 },
  recipeCopy: { flex: 1, padding: 12, justifyContent: 'center', gap: 5 },
  recipeTitle: { fontFamily: font.bold, fontSize: 17 },
  warning: { color: color.error, fontFamily: font.medium },
});
