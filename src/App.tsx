import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { GlassNav, type Tab } from './GlassNav';
import { MotionProvider, Scene, WebPolish } from './motion';
import { Library, type Filter } from './Library';
import { Onboarding } from './Onboarding';
import { CookProfile, EditCook, FindCooks } from './CookProfiles';
import type { CookLookup } from './socialApi';
import type { Personalization } from './allergens';
import { RecipeForm, type FormState } from './RecipeForm';
import { RecipeScreen } from './RecipeScreen';
import { featuredRecipes, lines, type Diet, type Recipe, type RecipeDraft } from './recipes';
import { ShoppingList } from './ShoppingList';
import type { ShoppingItem } from './shopping';
import { Action, color, Copy, font } from './ui';
import { DietSheet, Profile, RecipeOption, ShareSheet, Sheet, useSubmission, type ShareOptions } from './FlowSheets';
import { AccountAccess } from './AccountAccess';
import { accountsConfigured, importGuestRecipes, publishRecipe, readCommunity, readFollowingRecipes, readPublications, readSession, savePersonalization, saveProfile, saveRecipe, signOut, unpublishRecipe, type Account } from './cookbookApi';
import { exchangeAuthCallback, requestAccountDeletion, restoreNativeCallback, signInWithProvider } from './accountAuth';
import { monitorSession } from './supabase';

const storageKey = 'pinch.recipes.v1';
const preferenceKey = 'pinch.preference.v1';
const shoppingKey = 'pinch.shopping.v1';
const intentKey = 'to-taste.auth-intent.v1';

type Notice = { text: string; undo?: () => void; viewList?: boolean; error?: boolean; persistent?: boolean };
type AuthIntent = { kind: 'access' | 'link'; tab: Tab; selected?: string; share?: string; cook?: string; created: number };

function parseIntent(value: string): AuthIntent | null {
  try {
    const entry = JSON.parse(value) as AuthIntent;
    return entry && (entry.kind === 'access' || entry.kind === 'link')
      && ['explore', 'saved', 'shopping', 'profile'].includes(entry.tab)
      && typeof entry.created === 'number' && Date.now() - entry.created < 30 * 60_000 ? entry : null;
  } catch { return null; }
}

async function readGuestRecipes(): Promise<Recipe[]> {
  const value = await AsyncStorage.getItem(storageKey);
  return value ? JSON.parse(value) : [];
}
export default function App() {
  const [fontsReady, fontError] = useFonts({
    DMSans_400Regular: require('../assets/DMSans_400Regular.ttf'),
    DMSans_600SemiBold: require('../assets/DMSans_600SemiBold.ttf'),
    DMSans_700Bold: require('../assets/DMSans_700Bold.ttf'),
  });
  return <MotionProvider><SafeAreaProvider>
    <WebPolish />
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      {fontsReady || fontError ? <Cookbook /> : <View style={styles.center}><ActivityIndicator color={color.secondaryInk} /></View>}
    </SafeAreaView>
  </SafeAreaProvider></MotionProvider>;
}

function Cookbook() {
  const [recipes, setRecipes] = useState<Recipe[]>();
  const [readFailed, setReadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice>();
  const [account, setAccount] = useState<Account | null>(null);
  const [preference, setPreference] = useState<Diet>('any');
  const [onboarding, setOnboarding] = useState(false);
  const [showDietPrompt, setShowDietPrompt] = useState(false);
  const [dietSheet, setDietSheet] = useState(false);
  const [tab, setTab] = useState<Tab>('explore');
  const [filter, setFilter] = useState<Filter>('all');
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const latestShopping = useRef<ShoppingItem[]>([]);
  const shoppingWrites = useRef(Promise.resolve());
  const [selected, setSelected] = useState<string>();
  const [form, setForm] = useState<FormState>();
  const [addMenu, setAddMenu] = useState(false);
  const [draft, setDraft] = useState<FormState>();
  const [auth, setAuth] = useState(false);
  const [authError, setAuthError] = useState('');
  const [guestRecipes, setGuestRecipes] = useState<Recipe[]>([]);
  const [syncPrompt, setSyncPrompt] = useState(false);
  const [accountSettings, setAccountSettings] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const transfer = useSubmission();
  const settings = useSubmission();
  const deletion = useSubmission();
  const [share, setShare] = useState<string>();
  const [showSyncOffer, setShowSyncOffer] = useState(false);
  const [published, setPublished] = useState<Record<string, ShareOptions>>({});
  const [community, setCommunity] = useState<Recipe[]>([]);
  const [following, setFollowing] = useState<Recipe[]>();
  const [followingFailed, setFollowingFailed] = useState(false);
  const [followRevision, setFollowRevision] = useState(0);
  const [feed, setFeed] = useState<'explore' | 'following'>('explore');
  const [findCooks, setFindCooks] = useState(false);
  const [cook, setCook] = useState<CookLookup>();
  const [editCook, setEditCook] = useState(false);
  const [openedPost, setOpenedPost] = useState<Recipe>();
  const [profileLink, setProfileLink] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const handle = new URLSearchParams(window.location.search).get('cook');
    return handle && /^[a-z0-9][a-z0-9_]{2,23}$/.test(handle) ? handle : null;
  });
  const openedProfileLink = useRef(false);
  const latest = useRef<Recipe[]>([]);
  const writes = useRef(Promise.resolve());
  const draftWrites = useRef(Promise.resolve());
  const accountRef = useRef<Account | null>(null);
  const applyingSession = useRef<Promise<void> | null>(null);
  const ready = recipes !== undefined;

  function showError(error: unknown) {
    setNotice({ text: error instanceof Error ? error.message : 'Something went wrong. Try again.', error: true });
  }

  useEffect(() => {
    let active = true;
    setReadFailed(false);
    void Promise.all([
      AsyncStorage.getItem(storageKey), AsyncStorage.getItem(preferenceKey),
      restoreNativeCallback().catch(error => { if (active) setAuthError(error.message); }).then(readSession).catch(error => {
        if (active) setAuthError(error.message);
        return null;
      }),
      AsyncStorage.getItem(shoppingKey),
      AsyncStorage.getItem(intentKey),
    ]).then(async ([saved, localDiet, session, storedShopping, pendingIntent]) => {
      const data: unknown = saved === null ? [] : JSON.parse(saved);
      if (!Array.isArray(data) || !data.every((recipe) => recipe
        && typeof recipe.id === 'string' && typeof recipe.title === 'string' && typeof recipe.ingredients === 'string'
        && typeof recipe.instructions === 'string' && typeof recipe.minutes === 'string' && typeof recipe.servings === 'string')) {
        throw new Error('Invalid recipe data');
      }
      const user = session?.user ?? null;
      const intent = pendingIntent ? parseIntent(pendingIntent) : null;
      const savedDraft = await readDraft(user);
      if (!active) return;
      const savedShopping: unknown = storedShopping ? JSON.parse(storedShopping) : [];
      if (!Array.isArray(savedShopping) || !savedShopping.every((item) => item
        && typeof item.id === 'string' && typeof item.line === 'string'
        && typeof item.recipe === 'string' && typeof item.checked === 'boolean')) {
        throw new Error('Invalid shopping list data');
      }
      latestShopping.current = savedShopping;
      setShopping(savedShopping);
      accountRef.current = user;
      setAccount(user);
      latest.current = user ? session!.recipes : data;
      setRecipes(latest.current);
      setDraft(savedDraft);
      setGuestRecipes(data);
      setOnboarding(!user?.personalization);
      setShowDietPrompt(!localDiet && (!user || user.diet === 'any'));
      if (user) {
        setPreference(user.diet);
        if (pendingIntent) {
          restoreIntent(intent);
          if (intent?.kind === 'access') setSyncPrompt(data.length > 0);
          else if (intent?.kind === 'link') setNotice({ text: 'Sign-in method updated' });
          void AsyncStorage.removeItem(intentKey).catch(showError);
        }
      }
      else if (localDiet === 'any' || localDiet === 'vegan' || localDiet === 'vegetarian' || localDiet === 'pescatarian') setPreference(localDiet);
      if (!user && pendingIntent) {
        if (intent?.kind === 'access') {
          restoreIntent(intent);
          setAuth(true);
        }
      }
    }).catch(() => { if (active) setReadFailed(true); });
    return () => { active = false; };
  }, [loadAttempt]);

  function updateShopping(update: (current: ShoppingItem[]) => ShoppingItem[]) {
    const operation = shoppingWrites.current.then(async () => {
      const next = update(latestShopping.current);
      if (next === latestShopping.current) return;
      await AsyncStorage.setItem(shoppingKey, JSON.stringify(next));
      latestShopping.current = next;
      setShopping(next);
    });
    shoppingWrites.current = operation.catch(showError);
    return operation;
  }

  async function addIngredients(recipe: Recipe, indices: number[]) {
    let added = 0;
    const selected = new Set(indices);
    await updateShopping((current) => {
      const existing = new Set(current.map((item) => item.id));
      const items = lines(recipe.ingredients).flatMap((line, index): ShoppingItem[] => {
        const id = JSON.stringify([recipe.id, index, line]);
        return selected.has(index) && !existing.has(id) ? [{ id, line, recipe: recipe.title, checked: false }] : [];
      });
      added = items.length;
      return added ? [...current, ...items] : current;
    });
    setNotice({
      text: added ? `Added ${added} ${added === 1 ? 'ingredient' : 'ingredients'} to your list` : 'These ingredients are already on your list',
      viewList: true,
    });
  }

  function refreshCommunity() {
    void readCommunity().then(setCommunity).catch(() => {});
  }

  useEffect(() => {
    if (ready && !onboarding && tab === 'explore') refreshCommunity();
  }, [ready, onboarding, tab]);

  useEffect(() => {
    if (!account || onboarding || tab !== 'explore' || feed !== 'following') return;
    let active = true;
    setFollowingFailed(false);
    void readFollowingRecipes().then(posts => { if (active) setFollowing(posts); })
      .catch(() => { if (active) setFollowingFailed(true); });
    return () => { active = false; };
  }, [account?.id, onboarding, tab, feed, followRevision]);

  useEffect(() => {
    if (!ready || !account || onboarding || !profileLink || openedProfileLink.current) return;
    openedProfileLink.current = true;
    setCook({ handle: profileLink });
    const url = new URL(window.location.href);
    url.searchParams.delete('cook');
    window.history.replaceState(window.history.state, '', url);
  }, [ready, account, onboarding, profileLink]);

  useEffect(() => {
    let active = true;
    if (account) void readPublications(account.id).then((posts) => { if (active) setPublished(posts); }).catch(() => {});
    else setPublished({});
    return () => { active = false; };
  }, [account?.id]);

  useEffect(() => {
    if (!notice || notice.error || notice.persistent) return;
    const timeout = setTimeout(() => setNotice(undefined), 6500);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!selected) return false;
      setSelected(undefined);
      return true;
    });
    return () => back.remove();
  }, [selected]);

  function write(id: string, update: (current: Recipe[]) => Recipe[]): Promise<void> {
    const owner = accountRef.current;
    const operation = writes.current.then(async () => {
      const next = update(latest.current);
      if (owner?.id !== accountRef.current?.id) throw new Error('Your account changed. Try that action again.');
      if (owner) {
        const recipe = next.find((item) => item.id === id);
        await saveRecipe(owner.id, id, recipe);
      } else {
        try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); }
        catch { throw new Error('To Taste couldn’t save changes to this device. Try again.'); }
        setGuestRecipes(next);
      }
      if (owner?.id !== accountRef.current?.id) return;
      latest.current = next;
      setRecipes(next);
    });
    writes.current = operation.catch(() => {});
    return operation;
  }

  const discoveries = [...new Map([...featuredRecipes, ...community, ...(following ?? []), ...(openedPost ? [openedPost] : [])].map(recipe => [recipe.id, recipe])).values()];

  function favorite(id: string) {
    const found = discoveries.find((recipe) => recipe.id === id);
    let previous: Recipe | undefined;
    void write(id, (current) => {
      previous = current.find((recipe) => recipe.id === id);
      if (previous) return current.map((recipe) => recipe.id === id ? { ...recipe, favorite: !recipe.favorite } : recipe);
      return found ? [{ ...found, favorite: true }, ...current] : current;
    }).then(() => {
      const undo = () => {
        setNotice(undefined);
        // Keep a discovered recipe in the book only if it was saved before this action.
        void write(id, (current) => previous
          ? current.map((recipe) => recipe.id === id ? { ...recipe, favorite: previous!.favorite } : recipe)
          : current.filter((recipe) => recipe.id !== id)).catch(showError);
      };
      setNotice({ text: previous?.favorite ? 'Removed from Favorites' : 'Saved to Favorites', undo });
    }).catch(showError);
  }

  function saveDiscovery(recipe: Recipe) {
    void write(recipe.id, (current) => current.some((item) => item.id === recipe.id) ? current : [{ ...recipe }, ...current])
      .then(() => {
        setNotice({ text: 'Saved to your recipe book', undo: () => removeDiscovery(recipe) });
        if (!accountRef.current) setShowSyncOffer(true);
      }).catch(showError);
  }

  function removeDiscovery(recipe: Recipe) {
    void write(recipe.id, (current) => current.filter((item) => item.id !== recipe.id)).then(() => {
      setSelected(undefined);
      setNotice({ text: 'Removed from your recipe book', undo: () => saveDiscovery(recipe) });
    }).catch(showError);
  }

  async function save(value: RecipeDraft, existingId?: string) {
    const id = existingId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await write(id, (current) => existingId
      ? current.map((recipe) => recipe.id === id ? { ...recipe, ...value } : recipe)
      : [{ ...value, id, favorite: false }, ...current]);
    setForm(undefined);
    if (!existingId) {
      rememberDraft(undefined);
      if (!accountRef.current) setShowSyncOffer(true);
      setNotice({ text: 'Saved to your recipe book', undo: () => {
        void write(id, (current) => current.filter((recipe) => recipe.id !== id)).then(() => {
          rememberDraft({ mode: 'manual', draft: value });
          setNotice({ text: 'Moved back to drafts' });
        }).catch(showError);
      } });
    } else setNotice({ text: 'Recipe updated' });
  }

  async function remove(id: string) {
    await write(id, (current) => current.filter((recipe) => recipe.id !== id));
    setSelected(undefined);
    setForm(undefined);
    forgetPost(id);
    refreshCommunity();
  }

  function rememberDraft(value: FormState | undefined) {
    setDraft(value);
    const key = draftKey(accountRef.current);
    const operation = draftWrites.current.then(() => value
      ? AsyncStorage.setItem(key, JSON.stringify(value)) : AsyncStorage.removeItem(key));
    draftWrites.current = operation.catch(showError);
  }

  function forgetPost(id: string) {
    setPublished((posts) => {
      const next = { ...posts };
      delete next[id];
      return next;
    });
  }

  async function saveDiet(diet: Diet) {
    const owner = accountRef.current;
    if (owner && owner.diet !== diet) {
      const updated = { ...owner, ...await saveProfile(owner.id, { diet }) };
      if (accountRef.current?.id !== owner.id) return;
      accountRef.current = updated;
      setAccount(updated);
    }
    await AsyncStorage.setItem(preferenceKey, diet);
    setPreference(diet);
    setDietSheet(false);
    setShowDietPrompt(false);
  }

  async function finishWelcome(diet: Diet, personalization: Personalization) {
    const owner = accountRef.current;
    if (!owner) throw new Error('Sign in to save your preferences.');
    await saveDiet(diet);
    await savePersonalization(personalization);
    if (accountRef.current?.id !== owner.id) return;
    const updated = { ...accountRef.current, personalization };
    accountRef.current = updated;
    setAccount(updated);
    setTab('explore');
    setShowDietPrompt(false);
    setOnboarding(false);
  }

  function restoreIntent(intent: AuthIntent | null) {
    if (!intent || Date.now() - intent.created > 30 * 60_000) return;
    setTab(intent.tab);
    setSelected(intent.selected);
    setShare(intent.share);
    if (intent.cook && /^[a-z0-9][a-z0-9_]{2,23}$/.test(intent.cook)) setProfileLink(intent.cook);
  }

  async function prepareAuth(kind: AuthIntent['kind'] = 'access') {
    const destination = onboarding ? 'explore' : tab;
    await AsyncStorage.setItem(intentKey, JSON.stringify({ kind, tab: destination, selected, share,
      cook: !openedProfileLink.current ? profileLink : undefined, created: Date.now() }));
  }

  function applySession() {
    if (applyingSession.current) return applyingSession.current;
    const operation = loadAccount().finally(() => { applyingSession.current = null; });
    applyingSession.current = operation;
    return operation;
  }

  async function loadAccount() {
    const session = await readSession();
    const user = session.user;
    if (!user) throw new Error('To Taste couldn’t open your account. Try signing in again.');
    await writes.current;
    const wasGuest = !accountRef.current;
    const [userDraft, guest, intent, localDiet] = await Promise.all([
      readDraft(user), readGuestRecipes(), AsyncStorage.getItem(intentKey),
      AsyncStorage.getItem(preferenceKey),
    ]);
    accountRef.current = user;
    setAccount(user);
    setPreference(user.diet);
    setShowDietPrompt(!localDiet && user.diet === 'any');
    latest.current = session.recipes;
    setRecipes(session.recipes);
    setGuestRecipes(guest);
    setDraft(userDraft);
    setOnboarding(!user.personalization);
    setAuth(false);
    setAuthError('');
    setShowSyncOffer(false);
    if (intent) restoreIntent(parseIntent(intent));
    if (wasGuest && guest.length) setSyncPrompt(true);
    await AsyncStorage.removeItem(intentKey);
  }

  async function syncGuest(onlyId?: string) {
    const id = accountRef.current?.id;
    if (!id) throw new Error('Sign in to sync this cookbook.');
    const operation = writes.current.then(async () => {
      if (accountRef.current?.id !== id) throw new Error('Your account changed. Sign in and try again.');
      const guest = await readGuestRecipes();
      const batch = onlyId ? guest.filter(recipe => recipe.id === onlyId) : guest;
      const cloud = await importGuestRecipes(id, batch);
      if (accountRef.current?.id !== id) return;
      const remaining = onlyId ? guest.filter(recipe => recipe.id !== onlyId) : [];
      await AsyncStorage.setItem(storageKey, JSON.stringify(remaining));
      if (accountRef.current?.id !== id) return;
      latest.current = cloud;
      setRecipes(cloud);
      setGuestRecipes(remaining);
      setSyncPrompt(false);
      setNotice({ text: 'Recipes added to your account' });
    });
    writes.current = operation.catch(() => {});
    await operation;
  }

  async function restoreGuest() {
    if (!accountRef.current) return;
    accountRef.current = null;
    latest.current = [];
    setAccount(null);
    setFollowing(undefined);
    setFollowingFailed(false);
    setFeed('explore');
    setFindCooks(false);
    setCook(undefined);
    setEditCook(false);
    setOpenedPost(undefined);
    setOnboarding(true);
    setRecipes([]);
    setDraft(undefined);
    setSelected(undefined);
    setShare(undefined);
    setForm(undefined);
    setSyncPrompt(false);
    setAccountSettings(false);
    setDeletePrompt(false);
    setPublished({});
    setNotice(undefined);
    const [guest, guestDraft, guestDiet] = await Promise.all([readGuestRecipes(), readDraft(null), AsyncStorage.getItem(preferenceKey)]);
    latest.current = guest;
    setRecipes(guest);
    setGuestRecipes(guest);
    setDraft(guestDraft);
    setPreference(guestDiet === 'vegan' || guestDiet === 'vegetarian' || guestDiet === 'pescatarian' ? guestDiet : 'any');
  }

  useEffect(() => {
    const stop = monitorSession(() => void restoreGuest().catch(showError));
    const deepLink = Linking.addEventListener('url', ({ url }) => {
      void exchangeAuthCallback(url).then(completed => { if (completed) return applySession(); }).catch(error => {
        setAuthError(error.message);
        showError(error);
      });
    });
    return () => { stop(); deepLink.remove(); };
  }, []);

  async function logout() {
    try {
      await writes.current;
      await signOut();
      await restoreGuest();
      setNotice({ text: 'Signed out' });
    } catch (error) { showError(error); }
  }

  function closeAuth() {
    setAuth(false);
    setAuthError('');
    setShare(undefined);
    void AsyncStorage.removeItem(intentKey).catch(showError);
  }

  function postponeSync() {
    setSyncPrompt(false);
    if (share && !latest.current.some(recipe => recipe.id === share)) {
      setSelected(undefined);
      setShare(undefined);
      setTab('saved');
    }
  }

  if (!recipes) return <View style={styles.center}>
    {readFailed ? <>
      <Copy accessibilityRole="alert">To Taste couldn’t open your recipe book.</Copy>
      <Action label="Try again" onPress={() => setLoadAttempt((attempt) => attempt + 1)} />
    </> : <ActivityIndicator color={color.secondaryInk} />}
  </View>;

  const authSheet = auth && <AccountAccess close={closeAuth} prepare={prepareAuth} onSignedIn={applySession} error={authError} />;
  if (onboarding || !account) return <>
    <Onboarding key={account?.id ?? 'signup'} accountId={account?.id} initialDiet={preference} initial={account?.personalization} recipes={discoveries}
      edit={!!account?.personalization} complete={finishWelcome}
      cancel={account?.personalization ? () => setOnboarding(false) : undefined}
      signIn={accountsConfigured && !account ? () => setAuth(true) : undefined} />
    {notice?.error && <View style={[styles.notice, styles.noticeError]}><Copy accessibilityRole="alert">{notice.text}</Copy></View>}
    {authSheet}
  </>;

  const activeRecipe = recipes.find((recipe) => recipe.id === selected) ?? discoveries.find((recipe) => recipe.id === selected);
  const shareRecipe = recipes.find((recipe) => recipe.id === share);
  const recipeSaved = Boolean(activeRecipe && recipes.some((recipe) => recipe.id === activeRecipe.id));
  const recipeEditable = recipeSaved && activeRecipe?.discovery?.author === undefined && !activeRecipe?.id.startsWith('community:');
  const exploreRecipes = (feed === 'following' ? following ?? [] : [...featuredRecipes, ...community])
    .map((recipe) => ({ ...recipe, favorite: recipes.find((saved) => saved.id === recipe.id)?.favorite ?? false }));
  const libraryActive = tab === 'saved';
  function changeTab(next: Tab) {
    setSelected(undefined);
    setTab(next);
  }
  function startForm(state: FormState) {
    setAddMenu(false);
    setForm(state);
  }
  return <>
    <SafeAreaView edges={['top']} style={[styles.safe, activeRecipe && styles.covered]}
      accessibilityElementsHidden={Boolean(activeRecipe)} importantForAccessibility={activeRecipe ? 'no-hide-descendants' : 'auto'}
      aria-hidden={Boolean(activeRecipe)} pointerEvents={activeRecipe ? 'none' : 'auto'}>
      {!activeRecipe && <StatusBar style="dark" />}
      <View style={[styles.safe, tab !== 'explore' && styles.inactiveTab]} pointerEvents={tab === 'explore' ? 'auto' : 'none'}
        aria-hidden={tab !== 'explore'} importantForAccessibility={tab === 'explore' ? 'auto' : 'no-hide-descendants'}>
        <Library active={tab === 'explore'} explore recipes={exploreRecipes} filter="all" setFilter={setFilter} onOpen={setSelected} onFavorite={favorite}
          social={{ feed, setFeed, find: () => setFindCooks(true), loading: feed === 'following' && following === undefined && !followingFailed,
            failed: feed === 'following' && followingFailed, retry: () => setFollowRevision(value => value + 1) }}
          personalization={account.personalization}
          preference={preference} onDiet={() => setDietSheet(true)} onAdd={() => setAddMenu(true)}
          onDismissDiet={showDietPrompt ? () => void saveDiet('any').catch(showError) : undefined} />
      </View>
      <View style={[styles.safe, !libraryActive && styles.inactiveTab]} pointerEvents={libraryActive ? 'auto' : 'none'}
        aria-hidden={!libraryActive} importantForAccessibility={libraryActive ? 'auto' : 'no-hide-descendants'}>
        <Library active={libraryActive} recipes={recipes} filter={filter} setFilter={setFilter} onOpen={setSelected} onFavorite={favorite}
          personalization={account.personalization}
          preference={preference} onDiet={() => setDietSheet(true)} onAdd={() => setAddMenu(true)} />
      </View>
      {tab === 'shopping' && <ShoppingList items={shopping}
        onToggle={(ids) => void updateShopping((current) => {
          const selected = current.filter(item => ids.has(item.id));
          const checked = selected.some(item => !item.checked);
          return current.map(item => ids.has(item.id) ? { ...item, checked } : item);
        })}
        onRemove={(ids) => void updateShopping((current) => current.filter((item) => !ids.has(item.id)))}
        onClearChecked={() => void updateShopping((current) => current.filter((item) => !item.checked))}
        onExplore={() => changeTab('explore')} />}
      {tab === 'profile' && <Scene style={styles.safe}><Profile account={account} diet={preference} onDiet={() => setDietSheet(true)} onAuth={() => setAuth(true)} onLogout={() => void logout()}
        onPublicProfile={() => setCook({ id: account.id })}
        onSync={guestRecipes.length ? () => account ? setSyncPrompt(true) : setAuth(true) : undefined}
        onSettings={() => setAccountSettings(true)} onReplayWelcome={() => setOnboarding(true)} /></Scene>}
    </SafeAreaView>
    {activeRecipe && <RecipeScreen key={activeRecipe.id + activeRecipe.ingredients} recipe={activeRecipe}
      onAuthor={activeRecipe.discovery?.authorId ? () => setCook({ id: activeRecipe.discovery!.authorId! }) : undefined}
      reviewerId={account.id}
      allergens={account.personalization?.allergens}
      onBack={() => setSelected(undefined)} onFavorite={() => favorite(activeRecipe.id)}
      onAddIngredients={(indices) => addIngredients(activeRecipe, indices)}
      onSave={!recipeSaved ? () => saveDiscovery(activeRecipe) : undefined}
      onRemove={recipeSaved && !recipeEditable ? () => removeDiscovery(activeRecipe) : undefined}
      onEdit={recipeEditable ? () => setForm({ mode: 'manual', id: activeRecipe.id, draft: activeRecipe }) : undefined}
      onShare={recipeEditable && accountsConfigured ? () => {
        setShare(activeRecipe.id);
        if (!account) setAuth(true);
      } : undefined} />}
    {findCooks && <FindCooks close={() => setFindCooks(false)} open={lookup => { setFindCooks(false); setCook(lookup); }} />}
    {cook && !editCook && <CookProfile lookup={cook} account={account} close={() => setCook(undefined)} edit={() => setEditCook(true)}
      openRecipe={recipe => { setOpenedPost(recipe); setSelected(recipe.id); setCook(undefined); }}
      followChanged={() => setFollowRevision(value => value + 1)} />}
    {editCook && <EditCook account={account} close={() => setEditCook(false)} saved={() => {
      setEditCook(false);
      setCook({ id: account.id });
    }} />}
    {notice && <View style={[styles.notice, notice.error && styles.noticeError]}>
      <Copy accessibilityRole={notice.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.noticeText}>{notice.text}</Copy>
      {notice.undo && <Pressable accessibilityRole="button" onPress={notice.undo} style={styles.undo}><Copy style={styles.undoText}>Undo</Copy></Pressable>}
      {notice.viewList && <Pressable accessibilityRole="button" onPress={() => { setNotice(undefined); changeTab('shopping'); }} style={styles.undo}><Copy style={styles.undoText}>View list</Copy></Pressable>}
      {notice.persistent && <Pressable accessibilityRole="button" onPress={() => setNotice(undefined)} style={styles.undo}><Copy style={styles.undoText}>Dismiss</Copy></Pressable>}
      {accountsConfigured && !account && showSyncOffer && notice.text === 'Saved to your recipe book' &&
        <Pressable accessibilityRole="button" onPress={() => { setShowSyncOffer(false); setNotice(undefined); setAuth(true); }} style={styles.undo}><Copy style={styles.undoText}>Sync cookbook</Copy></Pressable>}
    </View>}
    {!activeRecipe && <GlassNav tab={tab} onChange={changeTab} onAdd={() => setAddMenu(true)} adding={addMenu || Boolean(form)} />}
    {addMenu && <Sheet title="Add a recipe" close={() => setAddMenu(false)}>
      {draft && <Action label="Resume draft" onPress={() => startForm(draft)} />}
      {!(process.env.EXPO_PUBLIC_STATIC_PREVIEW === '1' && Platform.OS === 'web') &&
        <RecipeOption title="Import link" description="Bring a recipe you love into To Taste." icon="link" onPress={() => startForm({ mode: 'import' })} />}
      <RecipeOption title="Write a recipe" description="Your ingredients. Your way." icon="edit" onPress={() => startForm({ mode: 'manual' })} />
    </Sheet>}
    {form && <RecipeForm state={form} close={() => setForm(undefined)} save={save} remove={remove} onDraft={form.id ? undefined : rememberDraft} />}
    {dietSheet && <DietSheet initial={preference} close={() => setDietSheet(false)} save={saveDiet} />}
    {authSheet}
    {syncPrompt && account && <Sheet title="Bring your recipes with you?" busy={transfer.busy} close={postponeSync}>
      <Copy>You have {guestRecipes.length} {guestRecipes.length === 1 ? 'recipe' : 'recipes'} on this device. Add them to your account to access them across devices.</Copy>
      {transfer.error ? <Copy accessibilityRole="alert">{transfer.error}</Copy> : null}
      <Action label={transfer.busy ? 'Adding recipes…' : `Add ${guestRecipes.length} ${guestRecipes.length === 1 ? 'recipe' : 'recipes'}`} disabled={transfer.busy} onPress={() => void transfer.run(() => syncGuest())} />
      {share && guestRecipes.length > 1 && guestRecipes.some(recipe => recipe.id === share) &&
        <Action secondary label="Add only the recipe I’m sharing" disabled={transfer.busy} onPress={() => void transfer.run(() => syncGuest(share))} />}
      <Action secondary label="Maybe later" disabled={transfer.busy} onPress={postponeSync} />
    </Sheet>}
    {accountSettings && account && !deletePrompt && <Sheet title="Account" busy={settings.busy} close={() => setAccountSettings(false)}>
      <Copy>Add a sign-in method to the account you’re using now.</Copy>
      {(['apple', 'google'] as const).map(provider => <Action key={provider} secondary label={provider === 'apple' ? 'Link Apple' : 'Link Google'}
        disabled={settings.busy} onPress={() => void settings.run(async () => {
          await prepareAuth('link');
          if (await signInWithProvider(provider, true)) {
            await AsyncStorage.removeItem(intentKey);
            setAccountSettings(false);
            setNotice({ text: 'Sign-in method updated' });
          }
        })} />)}
      {settings.error ? <Copy accessibilityRole="alert">{settings.error}</Copy> : null}
      <Action secondary label="Delete account" disabled={settings.busy} onPress={() => setDeletePrompt(true)} />
    </Sheet>}
    {deletePrompt && account && <Sheet title="Delete your account?" busy={deletion.busy} close={() => setDeletePrompt(false)}>
      <Copy>This permanently deletes your account, cloud cookbook, and published recipes. Shopping lists and guest recipes on this device stay here.</Copy>
      {deletion.error ? <Copy accessibilityRole="alert">{deletion.error}</Copy> : null}
      <Action label={deletion.busy ? 'Deleting account…' : 'Permanently delete account'} disabled={deletion.busy} onPress={() => void deletion.run(async () => {
        await writes.current;
        const manualRevoke = await requestAccountDeletion();
        await AsyncStorage.removeItem(draftKey(account)).catch(() => {});
        await restoreGuest();
        setNotice({ text: manualRevoke ? 'Account deleted. You can remove To Taste from Sign in with Apple in your Apple Account settings.' : 'Account deleted', persistent: manualRevoke });
      })} />
      <Action secondary label="Cancel" disabled={deletion.busy} onPress={() => setDeletePrompt(false)} />
    </Sheet>}
    {!auth && !syncPrompt && account && shareRecipe && <ShareSheet account={account} recipe={shareRecipe} close={() => setShare(undefined)} published={published[shareRecipe.id]}
      unpublish={async () => {
        await unpublishRecipe(account.id, shareRecipe.id);
        forgetPost(shareRecipe.id);
        setShare(undefined);
        setNotice({ text: 'Removed from Explore' });
        refreshCommunity();
      }}
      share={async (diet, onePan, weekend, name) => {
        const publisher = account.name === name ? account : { ...account, ...await saveProfile(account.id, { display_name: name }) };
        await publishRecipe(publisher, shareRecipe, { diet, onePan, weekend });
        if (accountRef.current?.id === account.id) {
          accountRef.current = publisher;
          setAccount(publisher);
        }
        setPublished((posts) => ({ ...posts, [shareRecipe.id]: { diet, onePan, weekend } }));
        setShare(undefined);
        setNotice({ text: 'Shared with the community' });
        refreshCommunity();
      }} />}
  </>;
}

const draftKey = (account: Account | null) => `pinch.draft.v1.${account?.id ?? 'guest'}`;
async function readDraft(account: Account | null): Promise<FormState | undefined> {
  const value = await AsyncStorage.getItem(draftKey(account));
  return value ? JSON.parse(value) : undefined;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.paper },
  inactiveTab: { display: 'none' },
  covered: { display: 'none' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notice: { position: 'absolute', bottom: 102, width: '90%', zIndex: 10, borderRadius: 22, shadowColor: '#111318', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 5 }, maxWidth: 620, alignSelf: 'center', minHeight: 43, paddingHorizontal: 18, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0F1F4F5', gap: 10 },
  noticeError: { backgroundColor: '#F9E3DF' },
  noticeText: { flex: 1, fontSize: 14, fontFamily: font.medium },
  undo: { padding: 7 },
  undoText: { fontSize: 14, color: color.secondaryInk, fontFamily: font.bold },
});
