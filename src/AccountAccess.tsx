import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, TextInput, View } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { Sheet, useSubmission } from './FlowSheets';
import { requestEmailCode, requestPhoneCode, signInWithProvider, verifyEmailCode, verifyPhoneCode, type Provider } from './accountAuth';
import { Action, color, Copy, font } from './ui';

export function AccountAccess({ close, onGuest, onSignedIn, prepare, error: initialError }: {
  close: () => void;
  onGuest: () => void;
  onSignedIn: () => Promise<void>;
  prepare: () => Promise<void>;
  error?: string;
}) {
  const [step, setStep] = useState<'options' | 'contact' | 'code'>('options');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<'email' | 'phone'>('phone');
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
  const byPhone = method === 'phone';
  const address = byPhone ? phone.trim().replace(/[\s().-]/g, '') : email.trim().toLowerCase();
  function go(value: typeof step) {
    setError('');
    setStep(value);
  }
  function send() {
    void run(async () => {
      if (byPhone) {
        if (!/^\+[1-9]\d{6,14}$/.test(address)) throw new Error('Enter your number with its country code, for example +357 99 123456.');
        await requestPhoneCode(address);
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.');
        await requestEmailCode(address);
      }
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
      if (code.length !== 6) throw new Error('Enter your six-digit verification code.');
      await prepare();
      try { await (byPhone ? verifyPhoneCode(address, code) : verifyEmailCode(address, code)); }
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

  const title = verified ? 'Open your cookbook' : step === 'options' ? 'Make it yours'
    : step === 'contact' ? (byPhone ? 'What’s your phone number?' : 'What’s your email?')
    : byPhone ? 'Check your messages' : 'Check your inbox';
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
        : <Action label="Continue with Apple" disabled={busy} onPress={() => social('apple')}>
            <Image accessible={false} source={require('../assets/apple-sign-in.png')} style={styles.providerIcon} resizeMode="contain" />
          </Action>}
      <Action secondary label="Continue with Google" disabled={busy} onPress={() => social('google')}>
        <Image accessible={false} source={require('../assets/google-sign-in.png')} style={styles.providerIcon} resizeMode="contain" />
      </Action>
      <Action secondary label="Continue with phone" disabled={busy} onPress={() => { setMethod('phone'); go('contact'); }} />
      <Action secondary label="Continue with email" disabled={busy} onPress={() => { setMethod('email'); go('contact'); }} />
      <Action secondary label="Continue as guest" disabled={busy} onPress={onGuest} />
    </>}
    {!verified && step === 'contact' && <>
      <Copy style={styles.helper}>{byPhone ? 'Include your country code. We’ll text you a sign-in code.' : 'We’ll send you a code to sign in or create your account.'}</Copy>
      {byPhone ? <TextInput key="phone" accessibilityLabel="Phone number" placeholder="+357 99 123456" style={styles.input}
        value={phone} onChangeText={setPhone} autoComplete="tel" keyboardType="phone-pad"
        editable={!busy} onSubmitEditing={send} />
        : <TextInput key="email" accessibilityLabel="Email address" placeholder="Email address" style={styles.input} value={email}
        onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email"
        keyboardType="email-address" editable={!busy} returnKeyType="go" onSubmitEditing={send} />}
      <Action label="Send code" disabled={busy} onPress={send} />
      <Action secondary label="Back to sign-in options" disabled={busy} onPress={() => go('options')} />
    </>}
    {!verified && step === 'code' && <>
      <Copy style={styles.helper}>{byPhone ? 'We texted' : 'We emailed'} a six-digit code to {address}. Enter it below or tap the code suggestion if it appears.</Copy>
      <TextInput accessibilityLabel="Verification code" placeholder="Six-digit code" style={[styles.input, styles.code]}
        value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
        autoComplete={Platform.OS === 'ios' ? undefined : 'one-time-code'}
        textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
        editable={!busy} onSubmitEditing={verify} />
      <Action label={byPhone ? 'Verify phone number' : 'Verify email'} disabled={busy || code.length !== 6} onPress={verify} />
      <Action secondary label={remaining ? `Resend code in ${remaining}s` : 'Resend code'} disabled={busy || remaining > 0} onPress={send} />
      <Action secondary label={byPhone ? 'Change phone number' : 'Change email'} disabled={busy} onPress={() => go('contact')} />
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
  providerIcon: { width: 18, height: 18 },
  error: { color: color.error, fontFamily: font.medium, lineHeight: 22 },
});
