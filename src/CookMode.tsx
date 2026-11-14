import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Scene, useReducedMotion } from './motion';
import { Glyph } from './Glyph';
import { lines, type Recipe } from './recipes';
import { Action, color, Copy, font, IconButton, IngredientCard } from './ui';

export function timerSuggestion(step: string) {
  const matches = [...step.matchAll(/(?:\bfor\s+|\babout\s+)(?:(?:about|another|a further)\s+)?(\d+(?:\.\d+)?)(?:\s*(?:–|-|to)\s*\d+(?:\.\d+)?)?\s*(seconds?|minutes?|hours?)\b/gi)];
  if (matches.length !== 1) return undefined;
  const [, amount, unit] = matches[0];
  const seconds = Math.round(Number(amount) * (unit.toLowerCase().startsWith('hour') ? 3600 : unit.toLowerCase().startsWith('minute') ? 60 : 1));
  return seconds > 0 && seconds <= 24 * 3600 ? { seconds, label: `${amount} ${unit.toLowerCase()}` } : undefined;
}

export type CookingTimer = { ends: number; step: number };

export function CookMode({ recipe, stepIndex, setStep, close, timer, setTimer, prepared, onTogglePrepared }: {
  recipe: Recipe; stepIndex: number; setStep: (index: number) => void; close: () => void;
  timer?: CookingTimer; setTimer: (timer: CookingTimer | undefined) => void;
  prepared: number[]; onTogglePrepared: (index: number) => void;
}) {
  const reduced = useReducedMotion();
  const [showIngredients, setShowIngredients] = useState(false);
  const [now, setNow] = useState(Date.now);
  const steps = lines(recipe.instructions);
  const ingredients = lines(recipe.ingredients);
  const step = steps[stepIndex] ?? '';
  const suggested = timerSuggestion(step);
  const seconds = timer ? Math.max(0, Math.ceil((timer.ends - now) / 1000)) : 0;
  const last = stepIndex === steps.length - 1;

  useEffect(() => {
    let mounted = true;
    const tag = `pinch.cooking.${recipe.id}`;
    void activateKeepAwakeAsync(tag).then(() => { if (!mounted) return deactivateKeepAwake(tag); }).catch(() => {});
    return () => { mounted = false; void deactivateKeepAwake(tag).catch(() => {}); };
  }, [recipe.id]);

  useEffect(() => {
    if (!timer || timer.ends <= Date.now()) return;
    const interval = setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= timer.ends) {
        clearInterval(interval);
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timer]);

  return <Modal visible onRequestClose={close} animationType={reduced ? 'none' : 'slide'}>
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Copy style={styles.recipe}>{recipe.title}</Copy>
          <Copy accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>
            {showIngredients ? 'Prep checklist' : `Step ${stepIndex + 1} of ${steps.length}`}
          </Copy>
        </View>
        <IconButton label="Exit cooking mode" onPress={close}><Glyph name="close" color={color.ink} /></IconButton>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} key={showIngredients ? 'ingredients' : stepIndex} contentContainerStyle={styles.content}>
        <Scene trigger={`${showIngredients}-${stepIndex}`}>{showIngredients ? <>
          <Copy accessibilityLiveRegion="polite" style={styles.recipe}>{prepared.length} of {ingredients.length} ready</Copy>
          {ingredients.map((line, index) => <IngredientCard key={index} line={line} checked={prepared.includes(index)}
            toggle={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
              onTogglePrepared(index);
            }} />)}
        </>
          : <Copy style={styles.step}>{step}</Copy>}</Scene>
        {!showIngredients && suggested && !timer && <Action secondary label={`Start timer · ${suggested.label}`} onPress={() => {
          const start = Date.now();
          setNow(start);
          setTimer({ ends: start + suggested.seconds * 1000, step: stepIndex });
        }}><Glyph name="timer" color={color.secondaryInk} /></Action>}
      </ScrollView>
      <View style={styles.footer}>
        {timer && <View style={styles.timer}>
          <View style={styles.titleBlock}>
            <Copy style={styles.recipe}>Step {timer.step + 1} timer</Copy>
            <Copy accessibilityLiveRegion={seconds === 0 ? 'assertive' : 'none'} style={styles.countdown}>
              {seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Time’s up'}
            </Copy>
          </View>
          <Action secondary label={seconds > 0 ? 'Cancel timer' : 'Dismiss'} onPress={() => setTimer(undefined)} />
        </View>}
        {ingredients.length > 0 && <Action secondary label={showIngredients ? 'Back to step' : 'Prep checklist'} onPress={() => setShowIngredients(!showIngredients)}>
          <Glyph name="ingredients" color={color.secondaryInk} />
        </Action>}
        {!showIngredients && <View style={styles.buttons}>
          <Action secondary style={styles.button} label="Back" disabled={stepIndex === 0} onPress={() => setStep(stepIndex - 1)} />
          <Action style={styles.button} label={last ? 'Finish' : 'Next'} onPress={() => {
            if (last && !timer) { setStep(0); close(); }
            else if (last) close();
            else setStep(stepIndex + 1);
          }} />
        </View>}
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: { padding: 20, borderBottomWidth: 1, borderColor: color.rule, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { flex: 1, gap: 3 },
  recipe: { color: color.secondaryInk, fontFamily: font.medium, fontSize: 14 },
  title: { fontFamily: font.display, fontSize: 30, lineHeight: 38, letterSpacing: -1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, gap: 18 },
  step: { fontSize: 27, lineHeight: 39 },
  footer: { width: '100%', maxWidth: 720, alignSelf: 'center', borderTopWidth: 1, borderColor: color.rule, padding: 18, gap: 10 },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 54 },
  timer: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: color.fill, padding: 12, borderRadius: 17 },
  countdown: { fontSize: 24, fontVariant: ['tabular-nums'], fontFamily: font.bold },
});
