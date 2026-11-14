import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Personalization } from './allergens';
import { submitAppFeedback, type AppFeedback } from './cookbookApi';
import { Field, Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { AllergenChoices, CookingChoices, DietPreferenceChoices } from './Onboarding';
import type { Diet } from './recipes';
import { Action, color, Copy, font } from './ui';

export type PreferencePage = 'diet' | 'allergens' | 'cooking';
export type SupportPage = AppFeedback['kind'];

const preferences = {
  diet: { title: 'Diet', description: 'Choose the diet you want Explore to prioritize.' },
  allergens: { title: 'Allergens', description: 'Choose what you need to avoid. We’ll flag matching ingredients. Always check product labels.' },
  cooking: { title: 'Cooking style', description: 'Choose the kinds of meals you’d like to see more often in Explore.' },
};

const supportTitles = { feedback: 'Give feedback', rating: 'Rate To Taste', help: 'Help' };
const helpTopics = [
  { title: 'How do I import a recipe?', answer: 'Tap Add, then Import link. Paste a recipe link. For a cooking video, you can also add its caption or upload a clip. Review the draft before saving it.' },
  { title: 'Who can see my recipes?', answer: 'Recipes in your cookbook are private until you publish them. Open Profile and go to My recipes to manage what you’ve shared.' },
  { title: 'How do I make a shopping list?', answer: 'Open a recipe and tap Add to shopping list below the ingredients. Select what you need, then find those items in Shopping.' },
];

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}>
    <Copy accessibilityRole="header" style={styles.heading}>{title}</Copy>
    <View style={styles.group}>{children}</View>
  </View>;
}

export function SettingsRow({ label, icon, value, onPress }: {
  label: string; icon: ComponentProps<typeof Glyph>['name']; value?: string; onPress: () => void;
}) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label}
    onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={styles.rowIcon}><Glyph name={icon} color={color.ink} size={20} /></View>
    <View style={styles.rowContent}>
      <Copy style={styles.rowLabel}>{label}</Copy>
      {value && <Copy style={styles.value}>{value}</Copy>}
    </View>
    <Glyph name="next" color={color.soft} size={15} />
  </MotionPressable>;
}

export function PreferenceSettings({ page, initialDiet, initial, back, saveDiet, savePreferences }: {
  page: PreferencePage; initialDiet: Diet; initial: Personalization; back: () => void;
  saveDiet: (diet: Diet) => Promise<void>; savePreferences: (patch: Partial<Personalization>) => Promise<void>;
}) {
  const [diet, setDiet] = useState(initialDiet);
  const [allergens, setAllergens] = useState(initial.allergens);
  const [cooking, setCooking] = useState(initial.cooking);
  const { busy, error, run } = useSubmission();
  const { title, description } = preferences[page];

  return <Sheet title={title} back={back} busy={busy}>
    <Copy style={styles.helper}>{description}</Copy>
    {page === 'diet' && <DietPreferenceChoices selected={diet} choose={value => { if (!busy) setDiet(value); }} />}
    {page === 'allergens' && <AllergenChoices selected={allergens} choose={values => { if (!busy) setAllergens(values); }} />}
    {page === 'cooking' && <CookingChoices selected={cooking} choose={values => { if (!busy) setCooking(values); }} />}
    {error ? <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy> : null}
    <Action label={busy ? 'Saving…' : 'Save changes'} disabled={busy} onPress={() => void run(async () => {
      if (page === 'diet') await saveDiet(diet);
      else await savePreferences(page === 'allergens' ? { allergens } : { cooking });
      back();
    })} />
  </Sheet>;
}

export function SupportSettings({ page, back }: { page: SupportPage; back: () => void }) {
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [topic, setTopic] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const { busy, error, run } = useSubmission();
  const isRating = page === 'rating';
  const isHelp = page === 'help';
  const confirmation = isRating ? 'Thanks for rating To Taste.' : isHelp ? 'Your help request was sent.' : 'Thanks for sharing your feedback.';

  return <Sheet title={supportTitles[page]} back={back} busy={busy}>
    {submitted ? <>
      <View style={styles.confirmation}>
        <View style={styles.confirmationIcon}><Glyph name="check" color={color.ink} size={22} /></View>
        <Copy accessibilityLiveRegion="polite" style={styles.confirmationText}>{confirmation}</Copy>
      </View>
      <Action label="Done" onPress={back} />
    </> : <>
      {isHelp && <View style={styles.section}>
        <Copy accessibilityRole="header" style={styles.heading}>Common questions</Copy>
        <View style={styles.group}>{helpTopics.map(item => <View key={item.title}>
          <MotionPressable accessibilityRole="button" accessibilityState={{ expanded: topic === item.title }}
            onPress={() => setTopic(topic === item.title ? undefined : item.title)} style={styles.row}>
            <Copy style={styles.question}>{item.title}</Copy>
            <Glyph name={topic === item.title ? 'close' : 'plus'} color={color.soft} size={16} />
          </MotionPressable>
          {topic === item.title && <Copy style={styles.answer}>{item.answer}</Copy>}
        </View>)}</View>
      </View>}
      {isRating ? <>
        <Copy style={styles.helper}>How’s your experience with To Taste?</Copy>
        <View accessibilityRole="radiogroup" accessibilityLabel="App rating" style={styles.stars}>
          {[1, 2, 3, 4, 5].map(value => <MotionPressable key={value} accessibilityRole="radio"
            accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`} aria-checked={rating === value}
            disabled={busy} onPress={() => setRating(value)} style={styles.star}>
            <Glyph name={value <= rating ? 'star-filled' : 'star'} color={value <= rating ? color.ink : color.soft} size={25} />
          </MotionPressable>)}
        </View>
      </> : <View style={styles.section}>
        {isHelp
          ? <Copy accessibilityRole="header" style={styles.heading}>Still need help?</Copy>
          : <Copy style={styles.helper}>Tell us what’s working or what you’d like us to improve.</Copy>}
        <Field label={isHelp ? 'How can we help?' : 'Your feedback'} multiline maxLength={2000}
          placeholder={isHelp ? 'Tell us what happened' : 'Share your thoughts'} value={message} onChangeText={setMessage}
          editable={!busy} style={styles.message} />
      </View>}
      {error ? <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy> : null}
      <Action label={busy ? 'Sending…' : isRating ? 'Submit rating' : isHelp ? 'Send help request' : 'Send feedback'}
        disabled={busy || (isRating ? rating === 0 : !message.trim())} onPress={() => void run(async () => {
          await submitAppFeedback(isRating ? { kind: page, rating } : { kind: page, message: message.trim() });
          setSubmitted(true);
        })} />
    </>}
  </Sheet>;
}

const styles = StyleSheet.create({
  section: { gap: 9 },
  heading: { color: color.secondaryInk, fontFamily: font.medium, fontSize: 14 },
  group: { backgroundColor: color.muted, borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15,
    paddingVertical: 11, gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.rule },
  pressed: { backgroundColor: color.rule },
  rowIcon: { width: 25, alignItems: 'center' },
  rowContent: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 },
  rowLabel: { fontFamily: font.medium, fontSize: 16 },
  value: { color: color.soft, fontSize: 13 },
  helper: { color: color.secondaryInk, lineHeight: 22 },
  question: { flex: 1, fontFamily: font.medium },
  answer: { paddingHorizontal: 15, paddingVertical: 11, color: color.secondaryInk, lineHeight: 21 },
  message: { minHeight: 114, textAlignVertical: 'top' },
  stars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: color.muted },
  error: { color: color.error },
  confirmation: { alignItems: 'center', paddingVertical: 22, gap: 12 },
  confirmationIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.muted, alignItems: 'center', justifyContent: 'center' },
  confirmationText: { textAlign: 'center', fontFamily: font.medium },
});
