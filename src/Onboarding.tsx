import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingArtwork } from './OnboardingArtwork';
import { Action, color, Copy, font } from './ui';
import { DietChoices, useSubmission } from './FlowSheets';
import { Scene } from './motion';
import { Glyph } from './Glyph';
import type { Diet } from './recipes';

export function Onboarding({ explore, signIn, initialDiet }: { explore: (diet?: Diet) => Promise<void>; signIn?: () => void; initialDiet: Diet }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 880;
  const [personalize, setPersonalize] = useState(false);
  const [diet, setDiet] = useState(initialDiet);
  const { busy, error, run } = useSubmission();
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.scroll, wide && styles.scrollWide]}>
      <View style={[styles.shell, wide && styles.shellWide]}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('../assets/icon.png')} style={styles.mark} />
            <Copy style={styles.wordmark}>To Taste</Copy>
          </View>
          <Copy accessibilityLabel={personalize ? 'Step 2 of 2' : 'Step 1 of 2'} style={styles.progressLabel}>{personalize ? '02' : '01'} / 02</Copy>
        </View>
        <View style={styles.progressTrack} accessible={false}>
          <View style={[styles.progressFill, { width: personalize ? '100%' : '50%' }]} />
        </View>
        <Scene key={String(personalize)} style={[styles.main, wide && styles.mainWide]}>
          <View style={[styles.artPanel, wide && styles.artPanelWide]}>
            {(!personalize || wide) && <OnboardingArtwork scene={personalize ? 'ingredients' : 'cookbook'} size={wide ? Math.min(470, width - 550) : Math.min(width - 48, 360, Math.max(180, height - 395))} />}
          </View>
          <View style={[styles.panel, wide && styles.panelWide]}>
            <View style={styles.content}>
              {personalize ? <>
                <Copy accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>How do you eat?</Copy>
                <Copy style={styles.description}>We’ll bring recipes that match your preference to the top of Explore. You can change this anytime.</Copy>
                <DietChoices selected={diet} setDiet={setDiet} />
                {error ? <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy> : null}
                <View style={styles.actions}>
                  <Action label={busy ? 'Opening…' : 'Explore recipes'} disabled={busy} onPress={() => void run(() => explore(diet))} style={styles.primary} />
                  <Action secondary label="Skip for now" disabled={busy} onPress={() => void run(() => explore())} />
                  <Action secondary label="Back" disabled={busy} onPress={() => setPersonalize(false)}><Glyph name="back" color={color.ink} size={16} /></Action>
                </View>
              </> : <>
                <Copy accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>{'All your recipes.\nReady to cook.'}</Copy>
                <Copy style={styles.description}>Save recipes from anywhere, shop for what you need, and cook step by step.</Copy>
                <View style={styles.actions}>
                  <Action label="Get started" onPress={() => setPersonalize(true)} style={styles.primary}><Glyph name="forward" color={color.white} size={16} /></Action>
                  {signIn && <Action secondary label="Sign in or create an account" onPress={signIn} />}
                </View>
              </>}
            </View>
          </View>
        </Scene>
      </View>
    </ScrollView>
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
  mark: { width: 36, height: 36, borderRadius: 11 },
  progressLabel: { color: color.secondaryInk, fontFamily: font.medium, fontSize: 12 },
  progressTrack: { height: 3, borderRadius: 3, overflow: 'hidden', backgroundColor: color.rule, marginTop: 14 },
  progressFill: { height: '100%', backgroundColor: color.ink },
  wordmark: { fontFamily: font.bold, fontSize: 28, letterSpacing: -1.3 },
  main: { flex: 1, justifyContent: 'center', paddingVertical: 12 },
  mainWide: { flexDirection: 'row', alignItems: 'center', gap: 64, paddingVertical: 42, minHeight: 650 },
  artPanel: { alignItems: 'center', justifyContent: 'center', marginHorizontal: -8 },
  artPanelWide: { flex: 1, minWidth: 0, alignSelf: 'stretch', borderRadius: 36, backgroundColor: '#F6F7F9', overflow: 'hidden', minHeight: 590, marginHorizontal: 0 },
  panel: { width: '100%', paddingBottom: 4 },
  panelWide: { width: 390 },
  content: { gap: 16 },
  title: { fontFamily: font.bold, fontSize: 38, lineHeight: 42, letterSpacing: -1.8 },
  titleWide: { fontSize: 45, lineHeight: 49, letterSpacing: -2.1 },
  description: { fontSize: 16, lineHeight: 24, color: color.secondaryInk },
  error: { color: color.error },
  actions: { gap: 7, marginTop: 6 },
  primary: { minHeight: 56 },
});
