import { useRef, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionPressable as Pressable, useSceneMotion, useReducedMotion } from './motion';
import { Glyph } from './Glyph';
import { dietOptions, type Diet, type Recipe } from './recipes';
import { accountsConfigured, type Account, type AccountMode, type Session, type SubmitAccount } from './pinchApi';
import { Action, color, Copy, Cover, font, IconButton, IngredientPreview } from './ui';

export function RecipeOption({ title, description, icon, onPress }: { title: string; description: string; icon: 'link' | 'edit'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.entryOption}>
    <View style={styles.entryIcon}><Glyph name={icon} size={23} color={color.ink} /></View>
    <View style={{ flex: 1, gap: 5 }}><Copy style={styles.entryTitle}>{title}</Copy><Copy style={styles.entryDescription}>{description}</Copy></View>
    <Glyph name="forward" size={18} color={color.soft} />
  </Pressable>;
}

export function Sheet({ title, close, children, busy = false }: { title: string; close: () => void; children: ReactNode; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  const motion = useSceneMotion(true, 24);
  const reduced = useReducedMotion();
  const dismiss = () => { if (!busy) motion.exit(close); };
  return <Modal visible transparent onRequestClose={dismiss} animationType={reduced ? 'none' : 'fade'}>
    <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable accessible={false} onPress={dismiss} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={[motion.style, styles.sheet, { paddingBottom: Math.max(14, insets.bottom), marginTop: insets.top }]}>
        <View style={styles.sheetHeader}>
          <Copy accessibilityRole="header" style={styles.sheetTitle}>{title}</Copy>
          <IconButton label="Close" disabled={busy} onPress={dismiss}><Glyph name="close" color={color.ink} /></IconButton>
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

export function DietChoices({ selected, setDiet }: { selected: Diet; setDiet: (diet: Diet) => void }) {
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

export function AccountForm({ mode, setMode, busy, submit, error, compact = false }: {
  mode: AccountMode; setMode: (mode: AccountMode) => void; busy: boolean;
  submit: (fields: Parameters<SubmitAccount>[1]) => void; error: string;
  compact?: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const register = mode === 'register';
  const send = () => {
    if (!busy && accountsConfigured) submit({ name: name.trim(), email: email.trim(), password });
  };
  if (!accountsConfigured) return <Copy style={styles.helper}>Accounts are unavailable in this build. You can still use To Taste as a guest.</Copy>;
  return <>
    {register && <Field label="Display name" value={name} onChangeText={setName} maxLength={60} autoComplete="name" editable={!busy} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailInput.current?.focus()} />}
    <Field inputRef={emailInput} label="Email" value={email} onChangeText={setEmail} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordInput.current?.focus()} />
    <Field inputRef={passwordInput} label="Password" value={password} onChangeText={setPassword} maxLength={128} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={register ? 'new-password' : 'current-password'} editable={!busy}
      placeholder={register ? 'At least 10 characters' : undefined} returnKeyType="go" onSubmitEditing={send}
      trailing={<Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} disabled={busy} onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}><Copy style={styles.passwordToggleLabel}>{showPassword ? 'Hide' : 'Show'}</Copy></Pressable>} />
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
    <Action label={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} disabled={busy} onPress={send} />
    {compact ? <Pressable accessibilityRole="button" accessibilityLabel={register ? 'I already have an account' : 'Create an account'} disabled={busy} style={styles.accountSwitch} onPress={() => {
      setPassword(''); setShowPassword(false); setMode(register ? 'login' : 'register');
    }}><Copy style={styles.accountSwitchText}>{register ? 'Already have an account? Sign in' : 'New to To Taste? Create an account'}</Copy></Pressable> : <Action secondary label={register ? 'I already have an account' : 'Create an account'} disabled={busy} onPress={() => {
      setPassword('');
      setShowPassword(false);
      setMode(register ? 'login' : 'register');
    }} />}
  </>;
}

export function validateAccount(mode: AccountMode, { name, email, password }: Parameters<SubmitAccount>[1]) {
  if (mode === 'register' && !name) throw new Error('Enter your display name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!password) throw new Error('Enter your password.');
  if (mode === 'register' && password.length < 10) throw new Error('Use at least 10 characters for your password.');
}

export function AccountSheet({ close, initialMode, onSubmit, onSignedIn, sharing }: {
  close: () => void; initialMode: AccountMode; sharing: boolean;
  onSubmit: SubmitAccount;
  onSignedIn: (session: Session) => Promise<void>;
}) {
  const [mode, setMode] = useState(initialMode);
  const { busy, error, run, setError } = useSubmission();
  const register = mode === 'register';
  return <Sheet title={register ? 'Create an account' : 'Welcome back'} busy={busy} close={close}>
    <Copy style={styles.helper}>{sharing ? 'Your recipe stays private until you review and share it.' : 'Take your recipe book with you and share dishes with the To Taste community.'}</Copy>
    <AccountForm mode={mode} busy={busy} error={error} setMode={(next) => { setMode(next); setError(''); }}
      submit={(fields) => void run(async () => {
        validateAccount(mode, fields);
        await onSignedIn(await onSubmit(mode, fields));
      })} />
  </Sheet>;
}

export type ShareOptions = { diet: Diet; onePan: boolean; weekend: boolean };

export function ShareSheet({ recipe, account, close, share, published, unpublish }: {
  recipe: Recipe; account: Account; close: () => void; share: (diet: Diet, onePan: boolean, weekend: boolean) => Promise<void>;
  published?: ShareOptions; unpublish: () => Promise<void>;
}) {
  const [diet, setDiet] = useState<Diet>(published?.diet ?? 'any');
  const [onePan, setOnePan] = useState(published?.onePan ?? false);
  const [weekend, setWeekend] = useState(published?.weekend ?? false);
  const { busy, error, run } = useSubmission();
  return <Sheet title="Share with the community" busy={busy} close={close}>
    <View style={styles.shareCover}><Cover recipe={recipe} /></View>
    <Copy style={styles.previewTitle}>{recipe.title}</Copy>
    <Copy style={styles.helper}>By {account.name}. Your photo, ingredients, directions, and original link will appear in Explore if included in the recipe.</Copy>
    <IngredientPreview ingredients={recipe.ingredients} />
    <Copy style={styles.choiceText}>Dietary tag</Copy>
    <DietChoices selected={diet} setDiet={setDiet} />
    <View style={styles.diets}>
      <Action secondary label={onePan ? '✓ One pan' : 'One pan'} accessibilityState={{ selected: onePan }} onPress={() => setOnePan(!onePan)} />
      <Action secondary label={weekend ? '✓ Weekend' : 'Weekend'} accessibilityState={{ selected: weekend }} onPress={() => setWeekend(!weekend)} />
    </View>
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
    <Action label={busy ? 'Working…' : published ? 'Update community recipe' : 'Publish recipe'} disabled={busy} onPress={() => void run(() => share(diet, onePan, weekend))} />
    {published && <Action secondary label="Remove from Explore" disabled={busy} onPress={() => void run(unpublish)} />}
  </Sheet>;
}

export function Profile({ account, diet, onDiet, onAuth, onLogout, onReplayWelcome }: {
  account: Account | null; diet: Diet; onDiet: () => void; onAuth: (mode: 'register' | 'login') => void; onLogout: () => void;
  onReplayWelcome: () => void;
}) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScroll}>
    <View style={styles.profile}>
      <View style={styles.avatar}><Glyph name="profile" size={31} color={color.secondaryInk} /></View>
      <Copy accessibilityRole="header" style={styles.profileTitle}>{account?.name ?? 'Your profile'}</Copy>
      {!account && <Copy style={styles.helper}>{accountsConfigured
        ? 'Create an account to sync your recipe book and share recipes with the community.'
        : 'Accounts are unavailable in this build. Your recipes are saved on this device.'}</Copy>}
      <View style={styles.profileCard}>
        <Copy style={styles.choiceText}>Diet preference</Copy>
        <Action secondary label={dietOptions[diet]} accessibilityLabel={`Change diet preference, ${dietOptions[diet]}`} onPress={onDiet} />
      </View>
      {account ? <Action secondary label="Sign out" onPress={onLogout} /> : accountsConfigured && <>
        <Action label="Create an account" onPress={() => onAuth('register')} />
        <Action secondary label="Sign in" onPress={() => onAuth('login')} />
      </>}
      <Action secondary label="Replay welcome" onPress={onReplayWelcome} />
    </View>
  </ScrollView>;
}

function Field({ label, inputRef, trailing, ...props }: TextInputProps & { label: string; inputRef?: React.RefObject<TextInput | null>; trailing?: ReactNode }) {
  return <View style={{ gap: 5 }}>
    <Copy style={styles.choiceText}>{label}</Copy>
    <View style={styles.fieldRow}><TextInput ref={inputRef} {...props} accessibilityLabel={label} placeholderTextColor={color.soft} style={[styles.field, { flex: 1, minWidth: 0 }]} />{trailing}</View>
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
  profileScroll: { padding: 26, paddingBottom: 130, alignItems: 'center' },
  profile: { width: '100%', maxWidth: 520, gap: 14 },
  avatar: { width: 57, height: 57, borderRadius: 29, backgroundColor: color.fill, alignItems: 'center', justifyContent: 'center' },
  profileTitle: { fontFamily: font.display, fontSize: 38, lineHeight: 45, letterSpacing: -1.3 },
  profileCard: { backgroundColor: color.muted, borderRadius: 21, padding: 16, gap: 10 },
  shareCover: { height: 140, borderRadius: 17, overflow: 'hidden' },
  previewTitle: { fontFamily: font.display, fontSize: 25, lineHeight: 31 },
});
