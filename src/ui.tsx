import type { ReactNode } from 'react';
import { Image, Platform, StyleSheet, Text, View, type PressableProps, type TextProps } from 'react-native';
import { MotionPressable as Pressable } from './motion';
import { BlurView } from 'expo-blur';
import { Glyph } from './Glyph';
import { ingredientAmount, parseIngredient } from './ingredients';
import { lines, type RecipeDraft } from './recipes';

export const color = {
  paper: '#FFFFFF', surface: '#FFFFFF', ink: '#17181A', soft: '#6B6E74', rule: '#E9EAED',
  muted: '#F3F4F6', secondaryInk: '#484B51', fill: '#F0F1F4', error: '#B3261E', white: '#FFFFFF',
};
export const font = {
  body: 'DMSans_400Regular', medium: 'DMSans_600SemiBold', bold: 'DMSans_700Bold',
  display: 'DMSans_700Bold',
};
const covers = {
  pasta: require('../assets/tomato-pasta-editorial.jpg'),
  chicken: require('../assets/lemon-chicken.jpg'),
  pancakes: require('../assets/blueberry-pancakes.jpg'),
  chickpeas: require('../assets/lemon-chickpeas.jpg'),
  salmon: require('../assets/lemon-salmon.jpg'),
};

export function Copy({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.text, style]} />;
}

export function Action({ label, children, secondary, style, ...props }: PressableProps & { label: string; children?: ReactNode; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" {...props} style={(state) => [
    styles.action, secondary && styles.secondary, props.disabled && styles.disabled, state.pressed && styles.pressed,
    typeof style === 'function' ? style(state) : style,
  ]}>
    {children}
    <Copy style={[styles.actionLabel, secondary && { color: color.ink }]}>{label}</Copy>
  </Pressable>;
}

export function IconButton({ label, children, selected, glass, ...props }: PressableProps & {
  label: string; children: ReactNode; selected?: boolean; glass?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    aria-pressed={selected} {...props}
    style={({ pressed }) => [styles.iconButton, glass && styles.glass, props.disabled && styles.disabled, pressed && styles.pressed]}>
    {glass && <View pointerEvents="none" style={StyleSheet.absoluteFill}><BlurView tint="dark" intensity={Platform.OS === 'web' ? 20 : 32} style={styles.glassBackdrop} /></View>}
    <View pointerEvents="none" style={styles.iconForeground}>{children}</View>
  </Pressable>;
}

export function Favorite({ favorite, onPress, glass }: { favorite: boolean; onPress: () => void; glass?: boolean }) {
  return <IconButton label={favorite ? 'Remove from favorites' : 'Add to favorites'} selected={favorite} glass={glass} onPress={onPress}>
    <Glyph name={favorite ? 'heart-filled' : 'heart'} color={glass ? color.white : color.ink} size={19} />
  </IconButton>;
}

export function Cover({ recipe }: { recipe: RecipeDraft }) {
  const source = recipe.cover ? covers[recipe.cover] : recipe.photo ? { uri: recipe.photo } : undefined;
  const emoji = lines(recipe.ingredients).map(parseIngredient).find((ingredient) => ingredient.emoji !== '🥣')?.emoji ?? '🍲';
  return <View testID="recipe-cover" style={styles.cover} accessible={false}>
    <Copy accessible={false} style={styles.coverEmoji}>{emoji}</Copy>
    {source && <Image source={source} accessible={false} accessibilityIgnoresInvertColors style={styles.coverImage} resizeMode="cover" />}
  </View>;
}

export function RecipeFacts({ recipe, overPhoto = false }: { recipe: RecipeDraft; overPhoto?: boolean }) {
  const servings = recipe.servings.replace(/\s+servings?$/i, '');
  const hasServingCount = /^\d+(?:[–-]\d+)?$/.test(servings);
  const ingredientCount = lines(recipe.ingredients).length;
  const facts = [
    ...(recipe.minutes ? [{ value: recipe.minutes, label: 'min' }] : []),
    ...(servings ? [{ value: servings, label: hasServingCount ? servings === '1' ? 'serving' : 'servings' : 'yield' }] : []),
    { value: String(ingredientCount), label: ingredientCount === 1 ? 'ingredient' : 'ingredients' },
  ];
  return <View style={styles.facts}>
    {facts.map((fact, index) => <View key={fact.label} style={[styles.fact, index > 0 && { borderLeftWidth: 1, borderColor: overPhoto ? '#FFFFFF45' : color.rule }]}>
      <Copy style={[styles.factValue, overPhoto && { color: color.white }]}>{fact.value}</Copy>
      <Copy style={[styles.factLabel, overPhoto && { color: '#FFFFFFD9' }]}>{fact.label}</Copy>
    </View>)}
  </View>;
}

export function IngredientPreview({ ingredients }: { ingredients: string }) {
  return <View style={styles.preview}>
    {lines(ingredients).slice(0, 4).map((line, index) => {
      const ingredient = parseIngredient(line);
      return <View key={index} style={styles.mini} accessibilityLabel={line}>
        <Copy style={styles.miniEmoji}>{ingredient.emoji}</Copy>
        {!!ingredient.quantity && <Copy style={styles.miniAmount}>{ingredientAmount(ingredient)}</Copy>}
      </View>;
    })}
  </View>;
}

export function IngredientCard({ line, checked, toggle }: { line: string; checked?: boolean; toggle?: () => void }) {
  const ingredient = parseIngredient(line);
  const content = <>
    <View style={styles.ingredientEmoji}><Copy style={{ fontSize: 26 }}>{ingredient.emoji}</Copy></View>
    <Copy style={[styles.ingredientName, checked && styles.struck]}>{ingredient.name}</Copy>
    {!!ingredient.quantity && <Copy style={styles.ingredientAmount}>{ingredientAmount(ingredient)}</Copy>}
    {toggle && <View style={[styles.checkbox, checked && styles.checked]}>
      {checked && <Glyph name="check" size={12} color={color.white} />}
    </View>}
  </>;
  return toggle
    ? <Pressable accessibilityRole="checkbox" accessibilityLabel={line} aria-checked={checked} onPress={toggle}
        style={({ pressed }) => [styles.ingredient, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={styles.ingredient}>{content}</View>;
}

export function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" aria-pressed={active} onPress={onPress}
    style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}>
    <Copy style={[styles.segmentLabel, active && { color: color.ink }]}>{label}</Copy>
  </Pressable>;
}

export const segmentTrack = { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 40, backgroundColor: color.muted } as const;

const styles = StyleSheet.create({
  text: { color: color.ink, fontFamily: font.body, fontSize: 15 },
  action: { minHeight: 50, borderRadius: 100, backgroundColor: color.ink, paddingHorizontal: 18, paddingVertical: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { color: color.white, fontFamily: font.medium, fontSize: 15, flexShrink: 1, minWidth: 0, textAlign: 'center' },
  secondary: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.rule },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
  iconButton: { flexShrink: 0, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.muted },
  glass: { overflow: 'hidden', backgroundColor: '#11131860', borderWidth: 1, borderColor: '#FFFFFF45' },
  glassBackdrop: { ...StyleSheet.absoluteFillObject, borderRadius: 22, overflow: 'hidden' },
  iconForeground: { zIndex: 1, justifyContent: 'center', alignItems: 'center' },
  cover: { flex: 1, backgroundColor: '#F0F1F4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverEmoji: { fontSize: 62 },
  coverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  facts: { flexDirection: 'row', justifyContent: 'center', width: '100%' },
  fact: { flex: 1, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', gap: 1 },
  factValue: { fontSize: 16, fontFamily: font.bold, textAlign: 'center' },
  factLabel: { fontSize: 12, color: color.soft, textAlign: 'center' },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mini: { minHeight: 31, borderRadius: 9, backgroundColor: color.muted, paddingHorizontal: 8, alignItems: 'center', flexDirection: 'row', gap: 5 },
  miniEmoji: { fontSize: 16 },
  miniAmount: { fontSize: 11, fontFamily: font.medium, color: color.soft },
  ingredient: { minHeight: 62, borderBottomWidth: 1, borderColor: color.rule, flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 },
  ingredientEmoji: { flexShrink: 0, width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: color.muted },
  ingredientName: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: font.medium },
  ingredientAmount: { color: color.soft, fontSize: 13, fontFamily: font.medium, textAlign: 'right', maxWidth: '30%' },
  struck: { textDecorationLine: 'line-through', color: color.soft },
  checkbox: { flexShrink: 0, height: 21, width: 21, borderRadius: 12, borderWidth: 1, borderColor: '#A1A5AC', marginLeft: 2, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: color.ink, borderColor: color.ink },
  segment: { flex: 1, minHeight: 44, borderRadius: 30, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: color.surface, shadowColor: '#111318', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  segmentLabel: { color: color.soft, fontFamily: font.medium, fontSize: 14, textAlign: 'center' },
});
