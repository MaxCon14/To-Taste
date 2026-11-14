import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Diet, Recipe } from './recipes';

export type Account = { id: string; name: string; diet: Diet };
export type Session = { user: Account | null; recipes: Recipe[]; token?: string };
export type AccountMode = 'register' | 'login';
export type AccountFields = { name: string; email: string; password: string };
export type SubmitAccount = (mode: AccountMode, fields: AccountFields) => Promise<Session>;
const native = Platform.OS !== 'web';
const base = native ? process.env.EXPO_PUBLIC_PINCH_API_URL?.replace(/\/$/, '') : '';
const tokenKey = 'pinch.session.v1';
export const accountsConfigured = !native || Boolean(base);

export async function pinchApi<T>(route: string, method = 'GET', payload?: unknown): Promise<T> {
  if (!accountsConfigured) throw new Error('Accounts and community sharing are unavailable in this build.');
  const token = native ? await SecureStore.getItemAsync(tokenKey) : null;
  const headers: Record<string, string> = {};
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (native) headers['X-To Taste-Native'] = '1';
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${base}/api/pinch/${route}`, {
      method, headers, signal: controller.signal, body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const data = await response.json().catch(() => {
      throw new Error('To Taste couldn’t reach its account service. Try again in a moment.');
    });
    if (!response.ok) throw new Error(data.message ?? 'To Taste couldn’t complete that request.');
    return data;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('To Taste couldn’t connect. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function signIn(mode: AccountMode, fields: AccountFields & { diet: Diet }) {
  const session = await pinchApi<Session>(mode, 'POST', fields);
  if (!session?.user) throw new Error('To Taste couldn’t open your account. Try signing in again.');
  if (native && session.token) await SecureStore.setItemAsync(tokenKey, session.token);
  return session;
}

export async function signOut() {
  await pinchApi('logout', 'POST');
  if (native) await SecureStore.deleteItemAsync(tokenKey);
}
