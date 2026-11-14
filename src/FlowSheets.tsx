import { useRef, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionPressable as Pressable, useSceneMotion, useReducedMotion } from './motion';
import { Glyph } from './Glyph';
import { dietOptions, type Diet, type Recipe } from './recipes';
import type { Account } from './cookbookApi';
import { Action, color, Copy, Cover, font, IconButton, IngredientPreview } from './ui';

export function RecipeOption({ title, description, icon, onPress }: { title: string; description: string; icon: 'link' | 'edit'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.entryOption}>
    <View style={styles.entryIcon}><Glyph name={icon} size={23} color={color.ink} /></View>
    <View style={{ flex: 1, gap: 5 }}><Copy style={styles.entryTitle}>{title}</Copy><Copy style={styles.entryDescription}>{description}</Copy></View>
    <Glyph name="forward" size={18} color={color.soft} />
  </Pressable>;
}

export function Sheet({ title, close, back, children, busy = false }: { title: string; close?: () => void; back?: () => void; children: ReactNode; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  const motion = useSceneMotion(true, 24);
  const reduced = useReducedMotion();
  const finish = close ?? back;
  const dismiss = () => { if (!busy && finish) motion.exit(finish); };
  return <Modal visible transparent onRequestClose={dismiss} animationType={reduced ? 'none' : 'fade'}>
    <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable accessible={false} onPress={dismiss} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={[motion.style, styles.sheet, { paddingBottom: Math.max(14, insets.bottom), marginTop: insets.top }]}>
        <View style={styles.sheetHeader}>
          {back && <IconButton label="Back to Settings" disabled={busy} onPress={back}><Glyph name="back" color={color.ink} /></IconButton>}
          <Copy accessibilityRole="header" style={styles.sheetTitle}>{title}</Copy>
          {close && <IconButton label="Close" disabled={busy} onPress={dismiss}><Glyph name="close" color={color.ink} /></IconButton>}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function useSubmission() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Try again in a moment.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return { busy, error, run, setError };
}

export function DietChoices({ selected, setDiet }: { selected: Diet | null; setDiet: (diet: Diet) => void }) {
  const descriptions = { any: 'A little of everything', vegan: 'All about plants', vegetarian: 'Plants, dairy & eggs', pescatarian: 'Plants & seafood' };
  return <View accessibilityRole="radiogroup" style={styles.diets}>
    {(Object.keys(dietOptions) as Diet[]).map((diet) => <Pressable key={diet} accessibilityRole="radio" aria-checked={selected === diet}
      onPress={() => setDiet(diet)} style={[styles.diet, selected === diet && styles.dietSelected]}>
      <View style={{ flex: 1, gap: 5 }}><Copy style={styles.choiceText}>{dietOptions[diet]}</Copy><Copy style={styles.dietHint}>{descriptions[diet]}</Copy></View>
    </Pressable>)}
  </View>;
}

export function DietSheet({ initial, close, save }: { initial: Diet; close: () => void; save: (diet: Diet) => Promise<void> }) {
  const [diet, setDiet] = useState(initial);
  const { busy, error, run } = useSubmission();
  return <Sheet title="Your preferences" busy={busy} close={close}>
    <Copy style={styles.helper}>We’ll bring recipes that match your preference to the top of Explore. You can change this anytime.</Copy>
    <DietChoices selected={diet} setDiet={setDiet} />
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
    <Action label="Save preference" disabled={busy} onPress={() => void run(() => save(diet))} />
  </Sheet>;
}

export type ShareOptions = { diet: Diet; onePan: boolean; weekend: boolean };

export function ShareSheet({ recipe, account, close, share, published, unpublish }: {
  recipe: Recipe; account: Account; close: () => void; share: (diet: Diet, onePan: boolean, weekend: boolean, name: string) => Promise<void>;
  published?: ShareOptions; unpublish: () => Promise<void>;
}) {
  const [diet, setDiet] = useState<Diet>(published?.diet ?? 'any');
  const [onePan, setOnePan] = useState(published?.onePan ?? false);
  const [weekend, setWeekend] = useState(published?.weekend ?? false);
  const [name, setName] = useState(account.name);
  const { busy, error, run } = useSubmission();
  return <Sheet title="Share with the community" busy={busy} close={close}>
    <View style={styles.shareCover}><Cover recipe={recipe} /></View>
    <Copy style={styles.previewTitle}>{recipe.title}</Copy>
    <Copy style={styles.helper}>Your photo, ingredients, directions, and original link will appear in Explore if included in the recipe.</Copy>
    {account.name
      ? <Copy>By {account.name}</Copy>
      : <Field label="Public display name" value={name} onChangeText={setName} maxLength={60} editable={!busy} />}
    <IngredientPreview ingredients={recipe.ingredients} />
    <Copy style={styles.choiceText}>Dietary tag</Copy>
    <DietChoices selected={diet} setDiet={setDiet} />
    <View style={styles.diets}>
      <Action secondary label={onePan ? '✓ One pan' : 'One pan'} accessibilityState={{ selected: onePan }} onPress={() => setOnePan(!onePan)} />
      <Action secondary label={weekend ? '✓ Weekend' : 'Weekend'} accessibilityState={{ selected: weekend }} onPress={() => setWeekend(!weekend)} />
    </View>
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
    <Action label={busy ? 'Working…' : published ? 'Update community recipe' : 'Publish recipe'} disabled={busy || !name.trim()} onPress={() => void run(() => share(diet, onePan, weekend, name.trim()))} />
    {published && <Action secondary label="Remove from Explore" disabled={busy} onPress={() => void run(unpublish)} />}
  </Sheet>;
}

export function Field({ label, inputRef, trailing, style, ...props }: TextInputProps & { label: string; inputRef?: React.RefObject<TextInput | null>; trailing?: ReactNode }) {
  return <View style={{ gap: 5 }}>
    <Copy style={styles.choiceText}>{label}</Copy>
    <View style={styles.fieldRow}><TextInput ref={inputRef} {...props} accessibilityLabel={label} placeholderTextColor={color.soft} style={[styles.field, { flex: 1, minWidth: 0 }, style]} />{trailing}</View>
  </View>;
}

const styles = StyleSheet.create({
  entryOption: { minHeight: 100, padding: 16, borderRadius: 22, backgroundColor: color.muted, flexDirection: 'row', alignItems: 'center', gap: 14 },
  entryIcon: { width: 43, height: 48, borderRadius: 14, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontFamily: font.bold, fontSize: 16, letterSpacing: -0.3 },
  entryDescription: { color: color.soft, fontSize: 12, lineHeight: 18 },
  modal: { flex: 1, alignItems: 'center', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', backgroundColor: '#11131866', paddingHorizontal: Platform.OS === 'web' ? 14 : 0 },
  sheet: { width: '100%', maxWidth: 510, maxHeight: '94%', borderRadius: 28, backgroundColor: color.surface, overflow: 'hidden' },
  sheetHeader: { paddingHorizontal: 26, paddingTop: 25, paddingBottom: 12, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { flex: 1, fontFamily: font.display, fontSize: 25, lineHeight: 31, letterSpacing: -0.8 },
  sheetContent: { paddingHorizontal: 26, paddingTop: 10, paddingBottom: 20, gap: 18 },
  helper: { color: color.soft, lineHeight: 22 },
  error: { color: color.error, fontFamily: font.medium },
  diets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diet: { minHeight: 84, flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: color.rule, backgroundColor: color.paper, alignItems: 'center', flexDirection: 'row', gap: 6 },
  dietHint: { color: color.soft, fontSize: 11, lineHeight: 16 },
  dietSelected: { borderColor: color.secondaryInk, backgroundColor: color.fill },
  choiceText: { fontFamily: font.medium, fontSize: 14 },
  field: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: color.muted, color: color.ink, fontFamily: font.body, fontSize: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.muted, borderRadius: 13 },
  passwordToggle: { minHeight: 46, minWidth: 49, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  passwordToggleLabel: { fontFamily: font.medium, fontSize: 12, color: color.secondaryInk },
  accountSwitch: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  accountSwitchText: { fontFamily: font.medium, fontSize: 13, textAlign: 'center', color: color.secondaryInk },
  shareCover: { height: 140, borderRadius: 17, overflow: 'hidden' },
  previewTitle: { fontFamily: font.display, fontSize: 25, lineHeight: 31 },
});
