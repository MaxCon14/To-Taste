import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MotionPreference = createContext(true);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; subscription.remove(); };
  }, []);
  return <MotionPreference.Provider value={reduced}>{children}</MotionPreference.Provider>;
}

export const useReducedMotion = () => useContext(MotionPreference);

export function useScreenFocus(testID: string) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
    return () => {
      cancelAnimationFrame(frame);
      requestAnimationFrame(() => { if (previous?.isConnected) previous.focus({ preventScroll: true }); });
    };
  }, [testID]);
}

export function MotionPressable({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const animate = (toValue: number) => {
    scale.stopAnimation();
    if (reduced) scale.setValue(1);
    else Animated.spring(scale, { toValue, damping: 24, stiffness: 420, mass: 0.65, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  useEffect(() => () => scale.stopAnimation(), [scale]);
  return <AnimatedPressable {...props}
    onPressIn={(event) => { setPressed(true); animate(0.97); onPressIn?.(event); }}
    onPressOut={(event) => { setPressed(false); animate(1); onPressOut?.(event); }}
    style={[typeof style === 'function' ? style({ pressed }) : style, { transform: [{ scale }] }]} />;
}

export function useSceneMotion(trigger: unknown = true, distance = 12) {
  const progress = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    progress.stopAnimation();
    if (reduced || !trigger) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [trigger, reduced, progress]);
  function exit(done: () => void) {
    if (reduced) { done(); return; }
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' })
      .start(({ finished }) => { if (finished) done(); });
  }
  return { style: { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }, exit };
}

export function Scene({ children, trigger = true, style }: { children: ReactNode; trigger?: unknown; style?: StyleProp<ViewStyle> }) {
  const motion = useSceneMotion(trigger);
  return <Animated.View style={[style, motion.style]}>{children}</Animated.View>;
}

export function WebPolish() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sheet = document.createElement('style');
    sheet.textContent = `
      html,body,#root { background:#fff; }
      * { -webkit-tap-highlight-color:transparent; }
      input,textarea { outline:none; }
      [role=heading][tabindex="-1"]:focus { outline:none; }
      input:focus-visible,textarea:focus-visible { box-shadow:0 0 0 3px #14141624; }
      [data-testid=recipe-search] input:focus { box-shadow:none; outline:none; caret-color:#17181a; }
      [data-testid=recipe-search] input::selection { color:#17181a; background:#d6d8dd; }
      [role=button]:focus-visible,[role=tab]:focus-visible,[role=checkbox]:focus-visible,[role=radio]:focus-visible,[role=link]:focus-visible { outline:2px solid #141416; outline-offset:4px; }
      [data-testid=recipe-card] { transition:box-shadow .28s ease; }
      [data-testid=recipe-card] [data-testid=recipe-cover] { transition:transform .7s cubic-bezier(.2,.7,.2,1); }
      @media(hover:hover) { [data-testid=recipe-card]:hover { box-shadow:0 12px 32px #17191d10; } [data-testid=recipe-card]:hover [data-testid=recipe-cover] { transform:scale(1.035); } }
      @media(prefers-reduced-transparency:reduce) { [data-testid=glass-nav] { background:#F3F4F6!important; backdrop-filter:none!important; } }
      @media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; } }
    `;
    document.head.appendChild(sheet);
    return () => sheet.remove();
  }, []);
  return null;
}
