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
import { ProfileEditor, ProfileIdentity } from './ProfileEditor';
import type { Account } from './cookbookApi';
import type { Cook } from './socialApi';

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

export function DietPreferenceChoices({ selected, choose }: { selected: Diet | null; choose: (value: Diet) => void }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel="Diet" style={styles.choices}>
    {(Object.keys(dietOptions) as Diet[]).map(item => <PreferenceChoice single key={item}
      label={dietOptions[item]} symbol={dietIcons[item]} active={selected === item} onPress={() => choose(item)} />)}
  </View>;
}

export function CookingChoices({ selected, choose }: { selected: PreferredCookingStyle[] | null; choose: (values: PreferredCookingStyle[]) => void }) {
  return <View style={styles.choices}>{(Object.keys(cookingStyles) as CookingStyle[]).map(item =>
    <PreferenceChoice featured key={item} label={cookingStyles[item]} symbol={cookingIcons[item]}
      active={item === 'any' ? selected?.length === 0 : selected?.includes(item) ?? false}
      onPress={() => {
        const current = selected ?? [];
        if (item === 'any') choose([]);
        else choose(current.includes(item) ? current.filter(value => value !== item) : [...current, item]);
      }} />)}</View>;
}

export function Onboarding({ account, signIn, recipes, complete, profileSaved }: {
  account: Account | null; signIn?: () => void; recipes: Recipe[]; profileSaved: (cook: Cook) => void;
  complete: (diet: Diet, preferences: Personalization) => Promise<void>;
}) {
  const [step, setStep] = useState(account ? (account.username ? 3 : 2) : 1);
  const [restored, setRestored] = useState(!account);
  const [selected, setSelected] = useState<Allergen[] | null>(account?.personalization?.allergens ?? null);
  const [diet, setDiet] = useState<Diet | null>(account?.personalization ? account.diet : null);
  const [cooking, setCooking] = useState<PreferredCookingStyle[] | null>(account?.personalization?.cooking ?? null);
  const [resumeAfterProfile, setResumeAfterProfile] = useState(4);
  const [profileBusy, setProfileBusy] = useState(false);
  const { busy, error, run } = useSubmission();
  const draftKey = account ? `to-taste.onboarding.${account.id}` : undefined;
  useEffect(() => {
    if (!draftKey) return;
    let active = true;
    void AsyncStorage.getItem(draftKey).then(value => {
      if (!active || !value) return;
      const draft = JSON.parse(value);
      if (Array.isArray(draft.selected)) setSelected(draft.selected);
      if (typeof draft.diet === 'string' && Object.hasOwn(dietOptions, draft.diet)) setDiet(draft.diet);
      const restoredCooking = readCookingPreferences(draft.cooking);
      if (restoredCooking !== null) setCooking(restoredCooking);
      if (draft.version === 3) {
        if (Number.isInteger(draft.step) && draft.step >= 2 && draft.step <= 7) setStep(draft.step);
        if (Number.isInteger(draft.resumeAfterProfile) && draft.resumeAfterProfile >= 4 && draft.resumeAfterProfile <= 7) {
          setResumeAfterProfile(draft.resumeAfterProfile);
        }
      } else if (Number.isInteger(draft.step) && draft.step >= 3 && draft.step <= 6) {
        const lastStep = draft.version !== 2 && draft.step === 5 && restoredCooking !== null ? 6 : draft.step;
        setResumeAfterProfile(Math.min(lastStep + 1, restoredCooking === null ? 6 : 7));
      }
    }).catch(() => {}).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => {
    if (draftKey && restored) void AsyncStorage.setItem(draftKey, JSON.stringify({ version: 3, step, selected, diet, cooking, resumeAfterProfile })).catch(() => {});
  }, [draftKey, restored, step, selected, diet, cooking, resumeAfterProfile]);
  const visibleStep = account ? (account.username ? Math.max(2, step) : 2) : 1;
  const recommendations = visibleStep === 7
    ? recipeRecommendations(recipes, diet ?? 'any', { allergens: selected ?? [], cooking: cooking ?? [] }).slice(0, 3)
    : [];

  return <SafeAreaView style={styles.screen}>
    <ScrollView key={visibleStep} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Image source={require('../assets/icon.png')} style={styles.mark} />
        <Copy style={styles.brand}>To Taste</Copy>
        <Copy style={styles.progressLabel}>{visibleStep} / 7</Copy>
      </View>
      <View aria-hidden style={styles.track}>{Array.from({ length: 7 }, (_, index) => <View key={index}
        style={[styles.progressSegment, index < visibleStep && styles.progressActive]} />)}</View>
      <Scene key={visibleStep} style={styles.content}>
        {visibleStep === 1 && <>
          <View style={styles.art}><OnboardingArtwork scene="cookbook" size={290} /></View>
          <Copy accessibilityRole="header" style={styles.title}>All your recipes. Ready to cook.</Copy>
          <Copy style={styles.description}>Save the recipes you love and discover meals that suit the way you eat.</Copy>
          {signIn ? <Action label="Get started" onPress={signIn} /> : <Copy>Accounts are unavailable in this build.</Copy>}
        </>}
        {visibleStep === 2 && account && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>Meet the cook.</Copy>
          <Copy style={styles.description}>Pick a name and username people can find you by.</Copy>
          <ProfileIdentity userId={account.id} initialName={account.name} initialHandle={account.username}
            saved={cook => { profileSaved(cook); setStep(3); }} />
        </>}
        {visibleStep === 3 && account && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>Make it yours.</Copy>
          <Copy style={styles.description}>Give your public profile a little personality. Add a photo, choose a banner, or tell us what you love to cook.</Copy>
          <ProfileEditor userId={account.id} onboarding onBusy={setProfileBusy}
            saved={cook => { profileSaved(cook); setStep(resumeAfterProfile); }} />
        </>}
        {visibleStep === 4 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>What do you need to avoid?</Copy>
          <Copy style={styles.description}>Select all that apply, or choose None. We’ll flag matching ingredients. Always check product labels.</Copy>
          <AllergenChoices selected={selected} choose={setSelected} />
          <Action label="Continue" disabled={selected === null} onPress={() => setStep(5)} />
        </>}
        {visibleStep === 5 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>How do you usually eat?</Copy>
          <Copy style={styles.description}>Choose one diet preference to see more recipes that suit you.</Copy>
          <DietPreferenceChoices selected={diet} choose={setDiet} />
          <Action label="Continue" disabled={diet === null} onPress={() => setStep(6)} />
        </>}
        {visibleStep === 6 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>What do you like to cook?</Copy>
          <Copy style={styles.description}>Select all the meals you’d like to see more often, or choose No preference.</Copy>
          <CookingChoices selected={cooking} choose={setCooking} />
          <Action label="See your recommendations" disabled={cooking === null} onPress={() => setStep(7)} />
        </>}
        {visibleStep === 7 && restored && <>
          <Copy accessibilityRole="header" style={styles.title}>What’s cooking?</Copy>
          <Copy style={styles.description}>A few picks to start your To Taste collection. Check the full ingredient list before you cook.</Copy>
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
        {visibleStep > 2 && restored && <Action secondary label="Back" disabled={busy || profileBusy} onPress={() => setStep(visibleStep - 1)} />}
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
  track: { flexDirection: 'row', gap: 4, marginTop: 16 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: color.rule },
  progressActive: { backgroundColor: color.ink },
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
