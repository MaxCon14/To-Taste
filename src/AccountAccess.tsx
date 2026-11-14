import { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { Sheet, useSubmission } from './FlowSheets';
import { requestEmailCode, signInWithProvider, verifyEmailCode, type Provider } from './accountAuth';
import { Action, color, Copy, font } from './ui';

export function AccountAccess({ close, onGuest, onSignedIn, prepare, error: initialError }: {
  close: () => void;
  onGuest: () => void;
  onSignedIn: () => Promise<void>;
  prepare: () => Promise<void>;
  error?: string;
}) {
  const [step, setStep] = useState<'options' | 'email' | 'code'>('options');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [nativeApple, setNativeApple] = useState(false);
  const [verified, setVerified] = useState(false);
  const { busy, error, setError, run } = useSubmission();
  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError, setError]);
  useEffect(() => {
    if (Platform.OS === 'ios') void Apple.isAvailableAsync().then(setNativeApple).catch(() => {});
  }, []);
  useEffect(() => {
    if (step !== 'code') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const address = email.trim().toLowerCase();
  function go(value: typeof step) {
    setError('');
    setStep(value);
  }
  function send() {
    void run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.');
      await requestEmailCode(address);
      const time = Date.now();
      setNow(time);
      setResendAt(time + 60_000);
      setCode('');
      setStep('code');
    });
  }
  function verify() {
    void run(async () => {
      if (verified) {
        await onSignedIn();
        return;
      }
      if (code.length !== 6) throw new Error('Enter the six-digit code from your email.');
      await prepare();
      try { await verifyEmailCode(address, code); }
      catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'otp_expired') {
          throw new Error('This code is incorrect or has expired. Check it or request a new one.');
        }
        throw error;
      }
      setVerified(true);
      await onSignedIn();
    });
  }
  function social(provider: Provider) {
    void run(async () => {
      await prepare();
      let completed: boolean;
      try {
        completed = await signInWithProvider(provider);
      } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') return;
        if (error instanceof Error && /isn’t available yet|Couldn’t reach sign-in/.test(error.message)) throw error;
        const method = provider === 'apple' ? 'Apple' : 'Google';
        throw new Error(method + ' sign-in couldn’t finish. Try again or choose another method.');
      }
      if (completed) {
        setVerified(true);
        await onSignedIn();
      }
    });
  }

  const title = verified ? 'Open your cookbook' : step === 'options' ? 'Make it yours' : step === 'email' ? 'What’s your email?' : 'Check your inbox';
  return <Sheet title={title} close={close} busy={busy}>
    {verified && <Action label="Try again" disabled={busy} onPress={verify} />}
    {!verified && step === 'options' && <>
      <Copy style={styles.helper}>Keep your saved recipes across devices.</Copy>
      {nativeApple
        ? <View pointerEvents={busy ? 'none' : 'auto'} accessibilityElementsHidden={busy}>
            <Apple.AppleAuthenticationButton buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK} cornerRadius={25}
              style={styles.apple} onPress={() => social('apple')} />
          </View>
        : <Action label="Continue with Apple" disabled={busy} onPress={() => social('apple')} />}
      <Action secondary label="Continue with Google" disabled={busy} onPress={() => social('google')} />
      <Action secondary label="Continue with email" disabled={busy} onPress={() => go('email')} />
      <Action secondary label="Continue as guest" disabled={busy} onPress={onGuest} />
    </>}
    {!verified && step === 'email' && <>
      <Copy style={styles.helper}>We’ll send you a code to sign in or create your account.</Copy>
      <TextInput accessibilityLabel="Email address" placeholder="Email address" style={styles.input} value={email}
        onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email"
        keyboardType="email-address" editable={!busy} returnKeyType="go" onSubmitEditing={send} />
      <Action label="Send code" disabled={busy} onPress={send} />
      <Action secondary label="Back to sign-in options" disabled={busy} onPress={() => go('options')} />
    </>}
    {!verified && step === 'code' && <>
      <Copy style={styles.helper}>Enter the six-digit code we sent to {address}. If your email includes a sign-in link, open it on this device.</Copy>
      <TextInput accessibilityLabel="Verification code" placeholder="Six-digit code" style={[styles.input, styles.code]}
        value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
        autoComplete="one-time-code" editable={!busy} onSubmitEditing={verify} />
      <Action label="Verify email" disabled={busy || code.length !== 6} onPress={verify} />
      <Action secondary label={remaining ? `Resend code in ${remaining}s` : 'Resend code'} disabled={busy || remaining > 0} onPress={send} />
      <Action secondary label="Change email" disabled={busy} onPress={() => go('email')} />
    </>}
    {busy && <Copy accessibilityLiveRegion="polite" style={styles.helper}>One moment…</Copy>}
    {error ? <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy> : null}
  </Sheet>;
}

const styles = StyleSheet.create({
  helper: { color: color.secondaryInk, lineHeight: 22 },
  input: { color: color.ink, fontFamily: font.body, fontSize: 16, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: color.muted },
  code: { letterSpacing: 3 },
  apple: { width: '100%', height: 50 },
  error: { color: color.error, fontFamily: font.medium, lineHeight: 22 },
});
