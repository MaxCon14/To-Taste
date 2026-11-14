import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingArtwork } from './OnboardingArtwork';
import { Action, color, Copy, font } from './ui';

export function Onboarding({ explore, signIn }: { explore: () => void; signIn?: () => void }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 880;
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.scroll, wide && styles.scrollWide]}>
      <View style={[styles.shell, wide && styles.shellWide]}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('../assets/icon.png')} style={styles.mark} />
            <Copy style={styles.wordmark}>To Taste</Copy>
          </View>
        </View>
        <View style={[styles.main, wide && styles.mainWide]}>
          <View style={[styles.artPanel, wide && styles.artPanelWide]}>
            <OnboardingArtwork scene="cookbook" size={wide ? Math.min(470, width - 550) : Math.min(width - 32, 360, Math.max(190, height - 395))} />
          </View>
          <View style={[styles.panel, wide && styles.panelWide]}>
            <View style={styles.content}>
              <Copy accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>{'Good food.\nAll in one place.'}</Copy>
              <Copy style={styles.description}>Save recipes you love and cook them step by step.</Copy>
              <View style={styles.actions}>
                <Action label="Explore recipes" onPress={explore} style={styles.primary} />
                {signIn && <Action secondary label="Sign in or create an account" onPress={signIn} />}
              </View>
            </View>
          </View>
        </View>
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
  mark: { width: 33, height: 35, borderRadius: 11, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
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
  description: { fontSize: 14, lineHeight: 22, color: color.secondaryInk },
  actions: { gap: 7, marginTop: 6 },
  primary: { minHeight: 56 },
});
