import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { AccountForm, useSubmission, validateAccount } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable, Scene, useScreenFocus } from './motion';
import { OnboardingArtwork } from './OnboardingArtwork';
import { accountsConfigured, type AccountMode, type Session, type SubmitAccount } from './pinchApi';
import { dietOptions, type Diet } from './recipes';
import { Action, color, Copy, font, IconButton } from './ui';

type Step = 'welcome' | 'ingredients' | 'account' | 'diet' | 'ready';
const dietDetails: Record<Diet, { emoji: string; title: string; description: string }> = {
  any: { emoji: '🍽️', title: 'A little of everything', description: 'Keep all the possibilities open' },
  vegetarian: { emoji: '🥑', title: 'Vegetarian', description: 'Plants, dairy & eggs' },
  vegan: { emoji: '🥬', title: 'Vegan', description: 'Good things, all from plants' },
  pescatarian: { emoji: '🐟', title: 'Pescatarian', description: 'Plants & a little seafood' },
};

export function Onboarding({ onSubmit, onSignedIn, finish, accountName, initialDiet = 'any', resumeDiet = false }: {
  onSubmit: SubmitAccount;
  onSignedIn: (session: Session, mode: AccountMode) => Promise<void>;
  finish: (diet: Diet) => Promise<void>;
  accountName?: string;
  initialDiet?: Diet;
  resumeDiet?: boolean;
}) {
  const [step, setStep] = useState<Step>(resumeDiet ? 'diet' : 'welcome');
  const [mode, setMode] = useState<AccountMode>('register');
  const [diet, setDiet] = useState<Diet>(initialDiet);
  const [name, setName] = useState(accountName ?? '');
  const [registered, setRegistered] = useState(Boolean(accountName));
  const { busy, error, run, setError } = useSubmission();
  const scroll = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  const wide = width >= 880;
  const intro = step === 'welcome' || step === 'ingredients';
  const stage = intro ? 0 : step === 'account' ? 1 : step === 'diet' ? 2 : 3;
  const heading = `onboarding-${step}-${mode}`;
  useScreenFocus(heading);

  const go = useCallback((next: Step) => {
    setError('');
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [setError]);

  const back = useCallback(() => {
    if (busy) return;
    if (step === 'ingredients') go('welcome');
    else if (step === 'account') go('ingredients');
    else if (step === 'diet' && !registered) go(accountsConfigured ? 'account' : 'ingredients');
    else if (step === 'ready') go('diet');
  }, [busy, go, registered, step]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'welcome') return false;
      back();
      return true;
    });
    return () => handler.remove();
  }, [back, step]);

  function start() { go(registered || !accountsConfigured ? 'diet' : 'account'); }
  function openAccount(next: AccountMode) { setMode(next); go('account'); }
  const canBack = step !== 'welcome' && !(step === 'diet' && registered);
  const art = step === 'ingredients' ? 'ingredients' : step === 'ready' ? 'ready' : 'cookbook';
  const title = step === 'welcome' ? 'Good food.\nAll in one place.'
    : step === 'ingredients' ? 'A recipe you can\nread at a glance.'
    : step === 'account' ? mode === 'register' ? 'Make room for\nyour favorites.' : 'Back for\nseconds?'
    : step === 'diet' ? 'Good taste.\nYour taste.' : 'Your next favorite\nis waiting.';
  const description = step === 'welcome' ? 'The recipes you find. The ones you make.\nA beautiful home for all of them.'
    : step === 'ingredients' ? 'Turn ingredients into simple visuals. Less looking back. More enjoying the cooking.'
    : step === 'account' ? mode === 'register' ? 'Create your own little corner of To Taste. Save recipes and take them with you.' : 'Your recipes, right where you left them.'
    : step === 'diet' ? 'What feels most like you? We’ll bring recipes you’ll love to the top of Explore.'
    : name ? `You’re right at home, ${name.split(' ')[0]}. Let’s find something delicious.` : 'Your place at the table is ready. Let’s find something delicious.';

  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, wide && styles.scrollWide]}>
        <View style={[styles.shell, wide && styles.shellWide]}>
          <View style={styles.header}>
            <View style={styles.brand}><View style={styles.mark}><Glyph name="ingredients" size={19} color={color.white} /></View><Copy style={styles.wordmark}>To Taste</Copy></View>
            {intro ? <MotionPressable accessibilityRole="button" onPress={start} style={styles.textButton}><Copy style={styles.link}>Skip intro</Copy></MotionPressable>
              : <Copy style={styles.headerNote}>{step === 'ready' ? 'Made for you' : 'A little more you'}</Copy>}
          </View>
          <View style={[styles.main, wide && styles.mainWide]}>
            {(wide || intro || step === 'ready') && <View style={[styles.artPanel, wide && styles.artPanelWide]}>
              <OnboardingArtwork scene={art} size={wide ? Math.min(470, width - 550) : Math.min(width - 32, 360, Math.max(190, height - 450))} />
              {wide && <View style={styles.artCaption}><Copy style={styles.artCaptionTitle}>A little inspiration. Every day.</Copy><Copy style={styles.artCaptionCopy}>Save it. Make it. Make it yours.</Copy></View>}
            </View>}
            <View style={[styles.panel, wide && styles.panelWide, !intro && step !== 'ready' && styles.formPanel]}>
              <View style={styles.stepRow}>
                {canBack && <IconButton label="Previous step" disabled={busy} onPress={back}><Glyph name="back" color={color.ink} size={17} /></IconButton>}
                <View style={styles.stepMeta}>
                  <Copy style={styles.eyebrow}>{intro ? 'WELCOME TO TO TASTE' : step === 'account' ? mode === 'register' ? 'YOUR OWN SPACE' : 'WELCOME BACK' : step === 'diet' ? 'A PERSONAL TOUCH' : 'ALL SET'}</Copy>
                  <View accessibilityLabel={`Setup step ${stage + 1} of 4`} style={styles.progress}>{[0, 1, 2, 3].map((i) => <View key={i} style={[styles.progressSegment, i <= stage && styles.progressActive]} />)}</View>
                </View>
              </View>
              <Scene trigger={heading} style={styles.content}>
                <Copy accessibilityRole="header" testID={heading} style={[styles.title, wide && styles.titleWide, width < 360 && styles.titleSmall]}>{title}</Copy>
                <Copy style={styles.description}>{description}</Copy>
                {intro && <>
                  <View style={styles.featureLine}><Glyph name={step === 'welcome' ? 'link' : 'ingredients'} size={16} color={color.soft} /><Copy style={styles.featureText}>{step === 'welcome' ? 'Import a link or make it your own' : 'Real ingredients. A simpler way to cook.'}</Copy></View>
                  <View style={styles.actions}>
                    <Action label={step === 'welcome' ? 'Meet your new cookbook' : registered ? 'Personalize my To Taste' : 'Make it mine'} onPress={() => step === 'welcome' ? go('ingredients') : start()} style={styles.primary} />
                    {accountsConfigured && !registered ? <MotionPressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={() => openAccount('login')} style={styles.textButton}><Copy style={styles.bottomCopy}>Already at the table? <Copy style={styles.inlineLink}>Sign in</Copy></Copy></MotionPressable>
                      : <Copy style={styles.bottomCopy}>A little less searching. A little more cooking.</Copy>}
                  </View>
                </>}
                {step === 'account' && <View style={styles.form}>
                  <AccountForm compact mode={mode} busy={busy} error={error} setMode={(next) => { setMode(next); setError(''); }}
                    submit={(fields) => void run(async () => {
                      validateAccount(mode, fields);
                      const session = await onSubmit(mode, fields);
                      await onSignedIn(session, mode);
                      if (mode === 'register') {
                        setName(session.user?.name ?? fields.name);
                        setRegistered(true);
                        go('diet');
                      }
                    })} />
                  <MotionPressable accessibilityRole="button" disabled={busy} onPress={() => go('diet')} style={styles.textButton}><Copy style={styles.link}>Continue as guest</Copy></MotionPressable>
                  <Copy style={styles.footnote}>Just browsing? Guest recipes stay on this device.</Copy>
                </View>}
                {step === 'diet' && <>
                  <View accessibilityRole="radiogroup" accessibilityLabel="Diet preference" style={styles.dietList}>
                    {(Object.keys(dietDetails) as Diet[]).map((item) => {
                      const selected = diet === item;
                      const detail = dietDetails[item];
                      return <MotionPressable key={item} accessibilityRole="radio" accessibilityLabel={`${detail.title}. ${detail.description}`} accessibilityState={{ checked: selected }} aria-checked={selected}
                        onPress={() => { setDiet(item); if (Platform.OS === 'ios') void Haptics.selectionAsync().catch(() => {}); }}
                        style={[styles.dietCard, selected && styles.dietSelected]}>
                        <Copy accessible={false} style={styles.dietEmoji}>{detail.emoji}</Copy>
                        <View style={styles.dietText}><Copy style={styles.dietTitle}>{detail.title}</Copy><Copy style={styles.dietDescription}>{detail.description}</Copy></View>
                        <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <Glyph name="check" color={color.white} size={12} />}</View>
                      </MotionPressable>;
                    })}
                  </View>
                  <Copy style={styles.footnote}>Always your choice. Change it anytime in Profile.</Copy>
                  <Action label="Find my inspiration" onPress={() => go('ready')} style={styles.primary} />
                  <MotionPressable accessibilityRole="button" onPress={() => { setDiet('any'); go('ready'); }} style={styles.textButton}><Copy style={styles.link}>Skip for now</Copy></MotionPressable>
                </>}
                {step === 'ready' && <>
                  <View style={styles.readyNote}><Glyph name="check" size={16} color={color.ink} /><Copy style={styles.readyCopy}>{diet === 'any' ? 'Open to a little of everything' : `${dietOptions[diet]} inspiration, picked for you`}</Copy></View>
                  {error ? <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy> : null}
                  <Action label={busy ? 'Getting things ready…' : 'Let’s explore'} disabled={busy} onPress={() => void run(() => finish(diet))} style={styles.primary} />
                  <Copy style={styles.footnote}>Discover something worth making.</Copy>
                </>}
              </Scene>
            </View>
          </View>
          {wide && <View style={styles.footer}><Copy style={styles.footerCopy}>GOOD FOOD. GOOD COMPANY.</Copy><Copy style={styles.footerCopy}>YOUR PERSONAL COOKBOOK</Copy></View>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18 },
  scrollWide: { paddingHorizontal: 48, paddingVertical: 28, justifyContent: 'center' },
  shell: { width: '100%', maxWidth: 460, flexGrow: 1 },
  shellWide: { maxWidth: 1180, flexGrow: 0 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 33, height: 35, borderRadius: 11, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: font.bold, fontSize: 28, letterSpacing: -1.3 },
  headerNote: { color: color.soft, fontSize: 12 },
  main: { flex: 1, justifyContent: 'center', paddingVertical: 12 },
  mainWide: { flexDirection: 'row', alignItems: 'center', gap: 64, paddingVertical: 42, minHeight: 650 },
  artPanel: { alignItems: 'center', justifyContent: 'center', marginHorizontal: -8 },
  artPanelWide: { flex: 1, minWidth: 0, alignSelf: 'stretch', borderRadius: 36, backgroundColor: '#F6F7F9', overflow: 'hidden', minHeight: 590, marginHorizontal: 0 },
  artCaption: { gap: 6, padding: 24, paddingTop: 0, alignItems: 'center' },
  artCaptionTitle: { fontFamily: font.medium, fontSize: 18, letterSpacing: -0.5 },
  artCaptionCopy: { fontSize: 13, color: color.soft },
  panel: { width: '100%', paddingBottom: 4 },
  panelWide: { width: 390 },
  formPanel: { paddingTop: 22 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44, marginBottom: 18 },
  stepMeta: { gap: 11 },
  eyebrow: { fontFamily: font.medium, fontSize: 10, letterSpacing: 2, color: color.soft },
  progress: { flexDirection: 'row', gap: 5 },
  progressSegment: { width: 25, height: 3, borderRadius: 3, backgroundColor: '#E9EAED' },
  progressActive: { backgroundColor: color.ink },
  content: { gap: 16 },
  title: { fontFamily: font.bold, fontSize: 38, lineHeight: 42, letterSpacing: -1.8 },
  titleWide: { fontSize: 45, lineHeight: 49, letterSpacing: -2.1 },
  titleSmall: { fontSize: 32, lineHeight: 36, letterSpacing: -1.3 },
  description: { fontSize: 14, lineHeight: 22, color: color.secondaryInk },
  featureLine: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  featureText: { color: color.soft, fontSize: 12, flexShrink: 1 },
  actions: { gap: 7, marginTop: 6 },
  primary: { minHeight: 56 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 10 },
  link: { color: color.secondaryInk, fontFamily: font.medium, fontSize: 13 },
  bottomCopy: { color: color.secondaryInk, fontSize: 12, textAlign: 'center', lineHeight: 20 },
  inlineLink: { color: color.secondaryInk, fontFamily: font.bold, fontSize: 12 },
  form: { gap: 14, paddingTop: 6 },
  footnote: { color: color.soft, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  dietList: { gap: 10, marginTop: 5 },
  dietCard: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84, padding: 17, borderRadius: 21, borderWidth: 1, borderColor: color.rule },
  dietSelected: { backgroundColor: '#F6F7F8', borderColor: color.ink },
  dietEmoji: { fontSize: 30, width: 37, textAlign: 'center' },
  dietText: { flex: 1, minWidth: 0, gap: 4 },
  dietTitle: { fontFamily: font.medium, fontSize: 14 },
  dietDescription: { color: color.soft, fontSize: 11, lineHeight: 16 },
  radio: { height: 22, width: 22, borderRadius: 11, borderWidth: 1, borderColor: '#C9CBD0', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: color.ink, borderColor: color.ink },
  readyNote: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 },
  readyCopy: { fontSize: 13, flexShrink: 1, color: color.secondaryInk },
  error: { color: color.error, fontFamily: font.medium },
  footer: { borderTopWidth: 1, borderColor: color.rule, paddingTop: 22, flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  footerCopy: { fontSize: 9, letterSpacing: 1.6, color: color.soft },
});
