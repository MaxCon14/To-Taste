import * as Apple from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as Browser from 'expo-web-browser';
import { Platform } from 'react-native';
import { requireSupabase } from './supabase';

export type Provider = 'apple' | 'google';
const googleWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export function authRedirect() {
  return Platform.OS === 'web' ? window.location.origin + '/' : 'totaste://auth/callback';
}

export async function requestEmailCode(email: string) {
  const { error } = await requireSupabase().auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirect() } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string) {
  const { data, error } = await requireSupabase().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('Sign-in didn’t finish. Request a new code and try again.');
}

function isCallback(url: string) {
  const received = new URL(url);
  const expected = new URL(authRedirect());
  return received.protocol === expected.protocol && received.host === expected.host && received.pathname === expected.pathname;
}

let pendingExchange: { code: string; result: Promise<boolean> } | undefined;

export async function exchangeAuthCallback(url: string): Promise<boolean> {
  if (!isCallback(url)) return false;
  const params = new URL(url).searchParams;
  if (params.has('error')) throw new Error('Sign-in couldn’t finish. Try again or use another method.');
  const code = params.get('code');
  if (!code) return false;
  if (pendingExchange?.code === code) return pendingExchange.result;
  const result = requireSupabase().auth.exchangeCodeForSession(code).then(({ data, error }) => {
    if (error) throw error;
    return Boolean(data.session);
  });
  pendingExchange = { code, result };
  return result;
}

export async function restoreNativeCallback() {
  if (Platform.OS === 'web') return;
  const url = await Linking.getInitialURL();
  if (url) await exchangeAuthCallback(url);
}

export async function signInWithProvider(provider: Provider, linking = false) {
  const client = requireSupabase();
  const providerLabel = provider === 'apple' ? 'Apple' : 'Google';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const settings = await fetch(process.env.EXPO_PUBLIC_SUPABASE_URL + '/auth/v1/settings', {
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!settings.ok) throw new Error('Couldn’t reach sign-in. Try again in a moment.');
  if (!(await settings.json()).external?.[provider]) {
    throw new Error(providerLabel + ' sign-in isn’t available yet. Choose another method.');
  }
  if (provider === 'apple' && Platform.OS === 'ios' && await Apple.isAvailableAsync()) {
    const nonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const result = await Apple.signInAsync({ nonce: hashed, requestedScopes: [Apple.AppleAuthenticationScope.EMAIL] });
    if (!result.identityToken) throw new Error('Apple didn’t return a sign-in token. Try again.');
    const payload = { provider, token: result.identityToken, nonce } as const;
    const { error } = linking ? await client.auth.linkIdentity(payload) : await client.auth.signInWithIdToken(payload);
    if (error) throw error;
    return true;
  }
  if (provider === 'google' && Platform.OS === 'ios' && googleWeb && googleIOS) {
    const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: googleWeb, iosClientId: googleIOS });
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) return false;
    if (!result.data.idToken) throw new Error('Google didn’t return a sign-in token. Try again.');
    const { accessToken } = await GoogleSignin.getTokens();
    const payload = { provider, token: result.data.idToken, access_token: accessToken } as const;
    const { error } = linking ? await client.auth.linkIdentity(payload) : await client.auth.signInWithIdToken(payload);
    if (error) throw error;
    return true;
  }
  const redirectTo = authRedirect();
  const request = { provider, options: { redirectTo, skipBrowserRedirect: true } };
  const { data, error } = linking ? await client.auth.linkIdentity(request) : await client.auth.signInWithOAuth(request);
  if (error) throw error;
  if (!data.url) throw new Error('The sign-in page is unavailable. Try again.');
  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return false;
  }
  const result = await Browser.openAuthSessionAsync(data.url, redirectTo);
  return result.type === 'success' && await exchangeAuthCallback(result.url);
}

export async function requestAccountDeletion() {
  const { data: { user }, error } = await requireSupabase().auth.getUser();
  if (error || !user) throw new Error('Sign in again before deleting your account.');
  let appleCode: string | undefined;
  if (user.identities?.some(identity => identity.provider === 'apple') && Platform.OS === 'ios' && await Apple.isAvailableAsync()) {
    try {
      const result = await Apple.signInAsync();
      appleCode = result.authorizationCode ?? undefined;
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
        throw new Error('Account deletion was canceled.');
      }
    }
  }
  const { data, error: deletionError } = await requireSupabase().functions.invoke('delete-account', { body: { appleCode } });
  if (deletionError) {
    const response = 'context' in deletionError ? deletionError.context : undefined;
    const details = response instanceof Response ? await response.json().catch(() => null) : null;
    throw new Error(details?.error || 'We couldn’t delete your account. Try again.');
  }
  if (!data?.deleted) throw new Error('We couldn’t confirm account deletion. Try again.');
  await requireSupabase().auth.signOut({ scope: 'local' });
  return Boolean(data.appleManualRevoke);
}
