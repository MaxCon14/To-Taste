import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Glyph } from './Glyph';
import { useReducedMotion } from './motion';
import { starterRecipes } from './recipes';
import { color, Copy, Cover, font } from './ui';

type ArtworkScene = 'cookbook' | 'ingredients' | 'ready';
const nativeDriver = Platform.OS !== 'web';

// A finite entrance, rather than a perpetual loop, keeps the form calm once it is ready.
function Reveal({ children, delay = 0, rotate = 0, style }: {
  children: React.ReactNode; delay?: number; rotate?: number; style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(progress, { toValue: 1, damping: 19, stiffness: 110, mass: 0.9, useNativeDriver: nativeDriver }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
  return <Animated.View style={[style, {
    opacity: progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [`${rotate - 6}deg`, `${rotate}deg`] }) },
    ],
  }]}>{children}</Animated.View>;
}

function RecipeCard({ index, small = false }: { index: number; small?: boolean }) {
  const recipe = starterRecipes[index];
  return <View style={[styles.card, small && styles.cardSmall]}>
    <View style={[styles.cover, small && styles.coverSmall]}><Cover recipe={recipe} /></View>
    <View style={styles.cardCopy}>
      <Copy allowFontScaling={false} style={styles.cardMeta}>{recipe.minutes} MIN · MADE WITH LOVE</Copy>
      <Copy allowFontScaling={false} style={[styles.cardTitle, small && styles.cardTitleSmall]}>{recipe.title}</Copy>
      {!small && <View style={styles.cardFoot}><Copy allowFontScaling={false} style={styles.cardFootText}>Your next favorite</Copy><Glyph name="heart" size={13} color={color.ink} /></View>}
    </View>
  </View>;
}

export function OnboardingArtwork({ scene, size }: { scene: ArtworkScene; size: number }) {
  const scale = size / 360;
  return <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View key={scene} style={[styles.canvas, { top: (size - 360) / 2, left: (size - 360) / 2, transform: [{ scale }] }]}>
      <View style={styles.halo} /><View style={styles.haloInner} />
      {scene === 'ingredients' ? <>
        <Reveal rotate={-5} style={styles.note}>
          <View style={styles.noteHeader}><Glyph name="edit" size={14} color={color.soft} /><Copy allowFontScaling={false} style={styles.noteLabel}>YOUR INGREDIENTS</Copy></View>
          <Copy allowFontScaling={false} style={styles.noteTitle}>2 onions</Copy>
          <View style={styles.noteRule} />
          <Copy allowFontScaling={false} style={styles.noteLine}>1 lemon</Copy>
          <Copy allowFontScaling={false} style={styles.noteLine}>3 tomatoes</Copy>
        </Reveal>
        <Reveal delay={300} rotate={90} style={styles.convert}><Glyph name="forward" color={color.white} size={18} /></Reveal>
        <Reveal delay={470} rotate={5} style={styles.ingredientTray}>
          <Copy allowFontScaling={false} style={styles.trayLabel}>INGREDIENTS AT A GLANCE</Copy>
          <View style={styles.tiles}>{[{ emoji: '🧅', amount: '× 2', name: 'Onions' }, { emoji: '🍋', amount: '× 1', name: 'Lemon' }, { emoji: '🍅', amount: '× 3', name: 'Tomatoes' }].map((item) => <View key={item.name} style={styles.tile}>
            <Copy allowFontScaling={false} style={styles.tileEmoji}>{item.emoji}</Copy>
            <Copy allowFontScaling={false} style={styles.tileAmount}>{item.amount}</Copy>
            <Copy allowFontScaling={false} style={styles.tileName}>{item.name}</Copy>
          </View>)}</View>
        </Reveal>
      </> : <>
        <Reveal delay={80} rotate={-15} style={styles.backLeft}><RecipeCard index={2} small /></Reveal>
        <Reveal delay={180} rotate={14} style={styles.backRight}><RecipeCard index={1} small /></Reveal>
        <Reveal delay={300} rotate={-4} style={styles.front}><RecipeCard index={0} /></Reveal>
        <Reveal delay={650} rotate={6} style={styles.ingredientBadge}><Copy allowFontScaling={false} style={styles.badgeEmoji}>🍅</Copy><View><Copy allowFontScaling={false} style={styles.badgeAmount}>500 g</Copy><Copy allowFontScaling={false} style={styles.badgeHint}>a little goodness</Copy></View></Reveal>
        <Reveal delay={800} rotate={-5} style={styles.savedBadge}><View style={styles.badgeCheck}><Glyph name="check" size={11} color={color.white} /></View><Copy allowFontScaling={false} style={styles.badgeText}>{scene === 'ready' ? 'Made for your table' : 'Saved to your cookbook'}</Copy></Reveal>
        {scene === 'ready' && <Reveal delay={950} style={styles.readySeal}><Glyph name="check" size={30} color={color.white} /></Reveal>}
      </>}
    </View>
  </View>;
}

const shadow = { shadowColor: '#182130', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 5 };
const styles = StyleSheet.create({
  canvas: { position: 'absolute', width: 360, height: 360 },
  halo: { position: 'absolute', width: 320, height: 320, borderRadius: 160, left: 20, top: 22, backgroundColor: '#F2F3F6' },
  haloInner: { position: 'absolute', width: 255, height: 255, borderRadius: 128, left: 53, top: 54, borderWidth: 1, borderColor: '#E6E8EC' },
  card: { width: 206, backgroundColor: '#FFF', borderRadius: 23, padding: 6, ...shadow },
  cardSmall: { width: 158, borderRadius: 19 },
  cover: { height: 175, borderRadius: 18, overflow: 'hidden' },
  coverSmall: { height: 137, borderRadius: 14 },
  cardCopy: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, gap: 7 },
  cardMeta: { fontSize: 6.5, letterSpacing: 0.7, color: color.soft, fontFamily: font.medium },
  cardTitle: { fontFamily: font.bold, fontSize: 17, lineHeight: 20, letterSpacing: -0.5 },
  cardTitleSmall: { fontSize: 13, lineHeight: 16 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  cardFootText: { color: color.soft, fontSize: 8 },
  backLeft: { position: 'absolute', left: 22, top: 74 },
  backRight: { position: 'absolute', right: 22, top: 67 },
  front: { position: 'absolute', left: 78, top: 30 },
  ingredientBadge: { position: 'absolute', right: 8, top: 174, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#FFFFFFF5', borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 19, ...shadow },
  badgeEmoji: { fontSize: 27 },
  badgeAmount: { fontFamily: font.bold, fontSize: 14 },
  badgeHint: { color: color.soft, fontSize: 8, marginTop: 2 },
  savedBadge: { position: 'absolute', left: 17, top: 302, flexDirection: 'row', gap: 7, alignItems: 'center', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 24, ...shadow },
  badgeCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: color.ink, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontFamily: font.medium, fontSize: 10 },
  readySeal: { position: 'absolute', right: 39, top: 49, width: 58, height: 58, backgroundColor: color.ink, borderRadius: 29, borderWidth: 4, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', ...shadow },
  note: { position: 'absolute', left: 42, top: 30, width: 236, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 22, gap: 11, ...shadow },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteLabel: { fontSize: 8, fontFamily: font.medium, letterSpacing: 1.3, color: color.soft },
  noteTitle: { fontFamily: font.medium, fontSize: 26, letterSpacing: -1 },
  noteRule: { backgroundColor: color.rule, height: 1 },
  noteLine: { color: color.soft, fontSize: 15 },
  convert: { position: 'absolute', right: 37, top: 141, backgroundColor: color.ink, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', ...shadow },
  ingredientTray: { position: 'absolute', left: 38, top: 204, width: 284, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 17, gap: 13, ...shadow },
  trayLabel: { fontSize: 8, fontFamily: font.medium, letterSpacing: 1.4, color: color.soft },
  tiles: { flexDirection: 'row', gap: 9 },
  tile: { flex: 1, backgroundColor: '#F4F5F7', borderRadius: 14, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tileEmoji: { fontSize: 29 },
  tileAmount: { fontFamily: font.bold, fontSize: 13 },
  tileName: { fontSize: 8, color: color.soft },
});
