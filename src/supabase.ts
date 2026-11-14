import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Split native sessions into small Keychain entries. Provider tokens can exceed
// the size supported by a single SecureStore entry on some versions of iOS.
const storage: SupportedStorage = {
  async getItem(key) {
    const size = Number(await SecureStore.getItemAsync(key));
    if (!Number.isInteger(size) || size < 1 || size > 100) return null;
    const pieces = await Promise.all(Array.from({ length: size }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return pieces.some(piece => piece === null) ? null : pieces.join('');
  },
  async setItem(key, value) {
    const size = Number(await SecureStore.getItemAsync(key)) || 0;
    const pieces = value.match(/[\s\S]{1,450}/g) ?? [''];
    await Promise.all(pieces.map((piece, i) => SecureStore.setItemAsync(`${key}.${i}`, piece)));
    await SecureStore.setItemAsync(key, String(pieces.length));
    for (let i = pieces.length; i < size; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
  async removeItem(key) {
    const size = Number(await SecureStore.getItemAsync(key)) || 0;
    await SecureStore.deleteItemAsync(key);
    for (let i = 0; i < size; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
};

export const supabase = url && key ? createClient(url, key, {
  auth: {
    flowType: 'pkce', persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    ...(Platform.OS !== 'web' ? { storage, lock: processLock } : {}),
  },
}) : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Sign-in is unavailable in this build.');
  return supabase;
}

export function monitorSession(onSignOut: () => void) {
  const events = supabase?.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') setTimeout(() => {
      void supabase?.auth.getSession().then(({ data }) => { if (!data.session) onSignOut(); });
    }, 0);
  });
  const app = Platform.OS !== 'web' ? AppState.addEventListener('change', state => {
    if (state === 'active') void supabase?.auth.startAutoRefresh();
    else void supabase?.auth.stopAutoRefresh();
  }) : undefined;
  return () => { events?.data.subscription.unsubscribe(); app?.remove(); };
}
