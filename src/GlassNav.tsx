import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, Copy, font } from './ui';
import { Glyph } from './Glyph';
import { MotionPressable, useReducedMotion } from './motion';

const items = [
  { id: 'explore', label: 'Explore', icon: 'explore' },
  { id: 'saved', label: 'Saved', icon: 'book' },
  { id: 'add', label: 'Add', icon: 'plus' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
] as const;

export type Tab = Exclude<(typeof items)[number]['id'], 'add'>;

export function GlassNav({ tab, onChange, onAdd, adding }: { tab: Tab; onChange: (tab: Tab) => void; onAdd: () => void; adding: boolean }) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const index = items.findIndex((item) => item.id === (adding ? 'add' : tab));
  const itemWidth = width / items.length;
  const position = useRef(new Animated.Value(index)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    position.stopAnimation();
    if (reduced) { position.setValue(index); return; }
    const animation = Animated.spring(position, { toValue: index, damping: 25, stiffness: 280, mass: 0.8, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, position]);
  return <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
    <View style={styles.shadow}>
      <View testID="glass-nav" role="navigation" accessibilityLabel="Main navigation" style={styles.bar} onLayout={(event) => setWidth(event.nativeEvent.layout.width - 14)}>
        <BlurView pointerEvents="none" tint="light" intensity={55} style={StyleSheet.absoluteFill} />
        <LinearGradient pointerEvents="none" colors={['#FFFFFFA6', '#FFFFFF38', '#F0F1F366']} style={StyleSheet.absoluteFill} />
        {width > 0 && <Animated.View pointerEvents="none" style={[styles.selection, {
          width: itemWidth,
          transform: [{ translateX: Animated.multiply(position, itemWidth) }],
        }]} />}
        {items.map(({ id, label, icon }) => <MotionPressable key={id} accessibilityRole={id === 'add' ? 'button' : 'tab'}
          accessibilityLabel={label} aria-selected={id === 'add' ? undefined : tab === id && !adding}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
            if (id === 'add') onAdd(); else onChange(id);
          }} style={styles.item}>
          <View style={[styles.icon, id === 'add' && styles.add]}><Glyph name={icon} size={21} color={id === 'add' ? color.white : color.ink} /></View>
          <Copy style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Copy>
        </MotionPressable>)}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 22, paddingTop: 8 },
  shadow: { width: '100%', maxWidth: 390, borderRadius: 42, shadowColor: '#14171D', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.15, shadowRadius: 28, elevation: 12 },
  bar: { flexDirection: 'row', padding: 6, borderRadius: 42, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFFE6', backgroundColor: Platform.OS === 'web' ? '#F2F3F64D' : '#F6F7F970',
    ...Platform.select({ web: { backdropFilter: 'blur(24px) saturate(180%)', boxShadow: 'inset 0 1px 1px #fff, inset 0 -1px 1px #ffffffa0, 0 0 0 1px #16181d0a' } }),
  },
  selection: { position: 'absolute', top: 6, bottom: 6, left: 6, borderRadius: 32, backgroundColor: '#FFFFFFB3', borderWidth: 1, borderColor: '#FFFFFFD9', shadowColor: '#111318', shadowOpacity: 0.07, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  item: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 32 },
  icon: { width: 29, height: 29, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  add: { backgroundColor: color.ink },
  label: { maxWidth: '100%', textAlign: 'center', fontFamily: font.medium, color: color.ink, fontSize: 10, lineHeight: 13 },
});
