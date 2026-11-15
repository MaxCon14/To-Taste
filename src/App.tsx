import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { GlassNav, type Tab } from './GlassNav';
import { MotionProvider, Scene, WebPolish } from './motion';
import { Library } from './Library';
import { EditCollection, SavedCollections, SaveToCollections } from './SavedCollections';
import { changeRecipeCollections, deleteCollection, importLegacySaves, readCollections, saveCollection, type NewCollection, type SavedCollection } from './collectionApi';
import { Onboarding } from './Onboarding';
import { CookProfile } from './CookProfiles';
import { ProfileEditor } from './ProfileEditor';
import { BookSheet, CreateBook } from './RecipeBooks';
import type { Cook, CookLookup, RecipeBook } from './socialApi';
import { cookingStyles, type Personalization } from './allergens';
import { PreferenceSettings, SettingsGroup, SettingsRow, SupportSettings, type PreferencePage, type SupportPage } from './Settings';
import { RecipeForm, type FormState } from './RecipeForm';
import { RecipeScreen } from './RecipeScreen';
import { dietOptions, featuredRecipes, lines, type Diet, type Recipe, type RecipeDraft } from './recipes';
import { ShoppingList } from './ShoppingList';
import type { ShoppingItem } from './shopping';
import { Action, color, Copy, font } from './ui';
import { DietSheet, RecipeOption, ShareSheet, Sheet, useSubmission, type ShareOptions } from './FlowSheets';
import { AccountAccess } from './AccountAccess';
import { accountsConfigured, importGuestRecipes, publishRecipe, readCommunity, readFollowingRecipes, readPublications, readSession, savePersonalization, saveProfile, saveRecipe, signOut, unpublishRecipe, type Account } from './cookbookApi';
import { exchangeAuthCallback, requestAccountDeletion, restoreNativeCallback, signInWithProvider } from './accountAuth';
import { monitorSession } from './supabase';
import { markCooked, readCooked, readShopping, writeShopping, type CookedRecipe } from './activityApi';
import { BlockedAccounts, ReportSheet, type ReportTarget } from './moderation';
import { parseSharedLink, readSharedContent, recipeShareLink, shareLink, sharedLinkFromUrl, SharedPreview, type SharedLink } from './SharedLinks';

const storageKey = 'pinch.recipes.v1';
const preferenceKey = 'pinch.preference.v1';
const shoppingKey = 'pinch.shopping.v1';
const intentKey = 'to-taste.auth-intent.v1';
const pendingLinkKey = (userId: string) => `to-taste.shared-link.${userId}`;

function readPendingLink(value?: string | null) {
  try { return value ? parseSharedLink(JSON.parse(value)) : undefined; }
  catch { return undefined; }
}

type Notice = { text: string; undo?: () => void; viewList?: boolean; error?: boolean; persistent?: boolean };
type AuthIntent = { kind: 'access' | 'link'; tab: Tab; selected?: string; share?: string; cook?: string; sharedLink?: SharedLink; created: number };

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
  const [collections, setCollections] = useState<SavedCollection[]>();
  const [collectionsFailed, setCollectionsFailed] = useState(false);
  const collectionLoad = useRef(0);
  const [collectionId, setCollectionId] = useState<string>();
  const [collectionEditor, setCollectionEditor] = useState<{ collection?: SavedCollection }>();
  const [collectionRecipe, setCollectionRecipe] = useState<Recipe>();
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [shoppingStatus, setShoppingStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [legacyShopping, setLegacyShopping] = useState<ShoppingItem[]>([]);
  const [importShopping, setImportShopping] = useState(false);
  const shoppingImport = useSubmission();
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
  const [settingsPage, setSettingsPage] = useState<PreferencePage | SupportPage | 'blocked'>();
  const [signInSettings, setSignInSettings] = useState(false);
  const [profileSection, setProfileSection] = useState<'posts' | 'recipes' | 'books'>('posts');
  const [profileRevision, setProfileRevision] = useState(0);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const transfer = useSubmission();
  const settings = useSubmission();
  const deletion = useSubmission();
  const [share, setShare] = useState<string>();
  const [published, setPublished] = useState<Record<string, ShareOptions>>({});
  const [community, setCommunity] = useState<Recipe[]>([]);
  const communityLoad = useRef(0);
  const [following, setFollowing] = useState<Recipe[]>();
  const [followingFailed, setFollowingFailed] = useState(false);
  const [followRevision, setFollowRevision] = useState(0);
  const [feed, setFeed] = useState<'explore' | 'following'>('explore');
  const [cook, setCook] = useState<CookLookup>();
  const [editCook, setEditCook] = useState(false);
  const [book, setBook] = useState<RecipeBook>();
  const [creatingBook, setCreatingBook] = useState(false);
  const [openedPost, setOpenedPost] = useState<Recipe>();
  const [sharedLink, setSharedLink] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined'
    ? sharedLinkFromUrl(window.location.href) : undefined);
  const [report, setReport] = useState<ReportTarget>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cooked, setCooked] = useState<CookedRecipe[]>();
  const [historyFailed, setHistoryFailed] = useState(false);
  const [socialRevision, setSocialRevision] = useState(0);
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
      const [savedDraft, savedDestination] = await Promise.all([
        readDraft(user), user ? AsyncStorage.getItem(pendingLinkKey(user.id)) : null,
      ]);
      if (!active) return;
      try {
        const savedShopping: unknown = storedShopping ? JSON.parse(storedShopping) : [];
        if (Array.isArray(savedShopping)) setLegacyShopping(savedShopping.filter(item => item
          && typeof item.id === 'string' && typeof item.line === 'string' && typeof item.recipe === 'string' && typeof item.checked === 'boolean'));
      } catch { /* Old shopping data is independent from loading the user's cookbook. */ }
      accountRef.current = user;
      setAccount(user);
      latest.current = user ? session!.recipes : data;
      setRecipes(latest.current);
      setDraft(savedDraft);
      setGuestRecipes(data);
      setOnboarding(!user?.personalization || !user.username);
      setShowDietPrompt(!localDiet && (!user || user.diet === 'any'));
      if (user) {
        const destination = parseSharedLink(intent?.sharedLink) ?? readPendingLink(savedDestination);
        if (destination) {
          setSharedLink(current => current ?? destination);
          await AsyncStorage.setItem(pendingLinkKey(user.id), JSON.stringify(destination));
        }
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
    const owner = accountRef.current?.id;
    const operation = shoppingWrites.current.then(async () => {
      if (!owner || accountRef.current?.id !== owner) throw new Error('Sign in again to update your list.');
      const current = latestShopping.current;
      const next = update(current);
      if (next === current) return;
      await writeShopping(current, next);
      if (accountRef.current?.id !== owner) return;
      latestShopping.current = next;
      setShopping(next);
    });
    shoppingWrites.current = operation.catch(showError);
    return operation;
  }

  function refreshShopping() {
    const owner = accountRef.current?.id;
    if (!owner) return;
    const operation = shoppingWrites.current.then(async () => {
      if (accountRef.current?.id !== owner) return;
      try {
        const items = await readShopping(owner);
        if (accountRef.current?.id !== owner) return;
        latestShopping.current = items;
        setShopping(items);
        setShoppingStatus('ready');
      } catch {
        if (accountRef.current?.id === owner) setShoppingStatus('error');
      }
    });
    shoppingWrites.current = operation.catch(() => {});
  }

  useEffect(() => {
    if (!account?.id) return;
    refreshShopping();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refreshShopping(); });
    return () => subscription.remove();
  }, [account?.id]);

  async function importDeviceList() {
    await updateShopping(current => {
      const existing = new Set(current.map(item => item.id));
      return [...current, ...legacyShopping.filter(item => !existing.has(item.id))];
    });
    await AsyncStorage.removeItem(shoppingKey);
    setLegacyShopping([]);
    setImportShopping(false);
    setNotice({ text: 'Shopping list imported' });
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
    const request = ++communityLoad.current;
    void readCommunity().then(value => { if (request === communityLoad.current) setCommunity(value); }).catch(() => {});
  }

  function moderationChanged() {
    setCook(undefined);
    setBook(undefined);
    setSelected(undefined);
    setOpenedPost(undefined);
    setCommunity([]);
    setFollowing(undefined);
    setSocialRevision(value => value + 1);
    setFollowRevision(value => value + 1);
    refreshCommunity();
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
    if (!ready || !account?.username || onboarding || !profileLink || openedProfileLink.current) return;
    openedProfileLink.current = true;
    setCook({ handle: profileLink });
    const url = new URL(window.location.href);
    url.searchParams.delete('cook');
    window.history.replaceState(window.history.state, '', url);
  }, [ready, account, onboarding, profileLink]);

  useEffect(() => {
    if (!ready || !account?.username || onboarding || !sharedLink) return;
    let active = true;
    void readSharedContent(sharedLink).then(content => {
      if (!active) return;
      setTab('explore');
      if (content?.kind === 'recipe') {
        setOpenedPost(content.recipe);
        setSelected(content.recipe.id);
      } else if (content?.kind === 'book') setBook(content.book);
      else setNotice({ text: 'This link is no longer available', error: true });
      clearSharedLink();
    }).catch(() => {
      if (!active) return;
      setNotice({ text: 'Couldn’t open this link. Try opening the original link again.', error: true });
      clearSharedLink();
    });
    return () => { active = false; };
  }, [ready, account?.username, onboarding, sharedLink]);

  function clearSharedLink() {
    setSharedLink(undefined);
    const userId = accountRef.current?.id;
    if (userId) void AsyncStorage.removeItem(pendingLinkKey(userId)).catch(() => {});
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('recipe');
    url.searchParams.delete('book');
    window.history.replaceState(window.history.state, '', url);
  }

  function openSharedNativeUrl(url?: string | null) {
    const link = sharedLinkFromUrl(url);
    if (link) setSharedLink(link);
  }

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
      if (selected) setSelected(undefined);
      else if (tab === 'saved' && collectionId) setCollectionId(undefined);
      else return false;
      return true;
    });
    return () => back.remove();
  }, [selected, tab, collectionId]);

  async function refreshCollections() {
    const owner = accountRef.current?.id;
    if (!owner) return;
    const request = ++collectionLoad.current;
    setCollectionsFailed(false);
    try {
      const result = await readCollections(owner);
      if (request === collectionLoad.current && accountRef.current?.id === owner) setCollections(result);
    } catch {
      if (request === collectionLoad.current && accountRef.current?.id === owner) setCollectionsFailed(true);
    }
  }

  useEffect(() => {
    if (account?.id) void refreshCollections();
  }, [account?.id]);

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

  async function recordCooking(recipe: Recipe) {
    const owner = accountRef.current?.id;
    if (!owner) throw new Error('Sign in to save your cooking history.');
    const operation = writes.current.then(async () => {
      if (accountRef.current?.id !== owner) return;
      await markCooked(recipe);
      if (accountRef.current?.id !== owner) return;
      if (!latest.current.some(item => item.id === recipe.id)) {
        latest.current = [recipe, ...latest.current];
        setRecipes(latest.current);
      }
      setCooked(previous => [{ recipe_id: recipe.id, cooked_at: new Date().toISOString() },
        ...(previous ?? []).filter(item => item.recipe_id !== recipe.id)]);
      setNotice({ text: 'Added to your cooking history' });
    });
    writes.current = operation.catch(() => {});
    return operation;
  }

  async function loadHistory() {
    const owner = accountRef.current?.id;
    if (!owner) return;
    setHistoryFailed(false);
    try {
      const result = await readCooked(owner);
      if (owner === accountRef.current?.id) setCooked(result);
    } catch {
      if (owner === accountRef.current?.id) setHistoryFailed(true);
    }
  }

  async function updateRecipeCollections(recipe: Recipe, add: string[], remove: string[], created?: NewCollection) {
    const owner = accountRef.current?.id;
    if (!owner) throw new Error('Sign in to save this recipe.');
    const operation = writes.current.then(async () => {
      if (accountRef.current?.id !== owner) throw new Error('Your account changed. Try again.');
      const snapshot = latest.current.find(item => item.id === recipe.id) ?? recipe;
      await changeRecipeCollections(snapshot, add, remove, created);
      if (accountRef.current?.id !== owner) return;
      if ((add.length || created) && !latest.current.some(item => item.id === recipe.id)) {
        latest.current = [snapshot, ...latest.current];
        setRecipes(latest.current);
      }
      await refreshCollections();
      if (accountRef.current?.id !== owner) return;
      setCollectionRecipe(undefined);
      setNotice({ text: add.length || created ? 'Saved to your collections' : 'Collections updated' });
    });
    writes.current = operation.catch(() => {});
    await operation;
  }

  async function save(value: RecipeDraft, existingId?: string) {
    const id = existingId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await write(id, (current) => existingId
      ? current.map((recipe) => recipe.id === id ? { ...recipe, ...value } : recipe)
      : [{ ...value, id, favorite: false }, ...current]);
    setForm(undefined);
    if (!existingId) {
      rememberDraft(undefined);
      setNotice({ text: 'Added to My recipes', undo: () => {
        void write(id, (current) => current.filter((recipe) => recipe.id !== id)).then(() => {
          rememberDraft({ mode: 'manual', draft: value });
          setNotice({ text: 'Moved back to drafts' });
        }).catch(showError);
      } });
    } else setNotice({ text: 'Recipe updated' });
  }

  async function remove(id: string) {
    await write(id, (current) => current.filter((recipe) => recipe.id !== id));
    void refreshCollections();
    setSelected(undefined);
    setForm(undefined);
    forgetPost(id);
    setProfileRevision(value => value + 1);
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
      const { diet: savedDiet } = await saveProfile(owner.id, { diet });
      if (accountRef.current?.id !== owner.id) return;
      const updated = { ...accountRef.current, diet: savedDiet };
      accountRef.current = updated;
      setAccount(updated);
    }
    await AsyncStorage.setItem(preferenceKey, diet);
    setPreference(diet);
    setDietSheet(false);
    setShowDietPrompt(false);
  }

  async function updatePersonalization(patch: Partial<Personalization>) {
    const owner = accountRef.current;
    if (!owner) throw new Error('Sign in to save your preferences.');
    const personalization = { allergens: [], cooking: [], ...owner.personalization, ...patch };
    await savePersonalization(personalization);
    if (accountRef.current?.id !== owner.id) return;
    const updated = { ...accountRef.current, personalization };
    accountRef.current = updated;
    setAccount(updated);
  }

  async function finishWelcome(diet: Diet, personalization: Personalization) {
    const owner = accountRef.current;
    if (!owner) throw new Error('Sign in to save your preferences.');
    await saveDiet(diet);
    if (accountRef.current?.id !== owner.id) return;
    await updatePersonalization(personalization);
    if (accountRef.current?.id !== owner.id) return;
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
    const destination = parseSharedLink(intent.sharedLink);
    if (destination) setSharedLink(destination);
  }

  async function prepareAuth(kind: AuthIntent['kind'] = 'access') {
    const destination = onboarding ? 'explore' : tab;
    await AsyncStorage.setItem(intentKey, JSON.stringify({ kind, tab: destination, selected, share,
      cook: !openedProfileLink.current ? profileLink : undefined, sharedLink, created: Date.now() }));
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
    setOnboarding(!user.personalization || !user.username);
    setAuth(false);
    setAuthError('');
    if (intent) {
      const pending = parseIntent(intent);
      const destination = parseSharedLink(pending?.sharedLink);
      if (destination) await AsyncStorage.setItem(pendingLinkKey(user.id), JSON.stringify(destination));
      restoreIntent(pending);
    }
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
      await importLegacySaves(id, batch);
      if (accountRef.current?.id !== id) return;
      const remaining = onlyId ? guest.filter(recipe => recipe.id !== onlyId) : [];
      await AsyncStorage.setItem(storageKey, JSON.stringify(remaining));
      if (accountRef.current?.id !== id) return;
      latest.current = cloud;
      setRecipes(cloud);
      void refreshCollections();
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
    communityLoad.current += 1;
    setCommunity([]);
    latestShopping.current = [];
    setShopping([]);
    setShoppingStatus('loading');
    setImportShopping(false);
    setHistoryOpen(false);
    setCooked(undefined);
    setReport(undefined);
    setSharedLink(undefined);
    collectionLoad.current += 1;
    setCollections(undefined);
    setCollectionsFailed(false);
    setCollectionId(undefined);
    setCollectionRecipe(undefined);
    setCollectionEditor(undefined);
    setFollowing(undefined);
    setFollowingFailed(false);
    setFeed('explore');
    setCook(undefined);
    setEditCook(false);
    setBook(undefined);
    setCreatingBook(false);
    setOpenedPost(undefined);
    setOnboarding(true);
    setRecipes([]);
    setDraft(undefined);
    setSelected(undefined);
    setShare(undefined);
    setForm(undefined);
    setSyncPrompt(false);
    setAccountSettings(false);
    setSettingsPage(undefined);
    setSignInSettings(false);
    setProfileSection('posts');
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
    if (Platform.OS !== 'web') void Linking.getInitialURL().then(openSharedNativeUrl).catch(() => {});
    const deepLink = Linking.addEventListener('url', ({ url }) => {
      openSharedNativeUrl(url);
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

  function applyCookProfile(profile: Cook) {
    const owner = accountRef.current;
    if (owner?.id !== profile.user_id) return;
    const updated = { ...owner, name: profile.name, username: profile.handle };
    accountRef.current = updated;
    setAccount(updated);
  }

  const authSheet = auth && <AccountAccess close={closeAuth} prepare={prepareAuth} onSignedIn={applySession} error={authError} />;
  if (!account && sharedLink && accountsConfigured) return <>
    <SharedPreview link={sharedLink} signIn={() => setAuth(true)} explore={clearSharedLink} />
    {authSheet}
  </>;
  if (onboarding || !account || !account.username) return <>
    <Onboarding key={account?.id ?? 'signup'} account={account} recipes={discoveries} complete={finishWelcome} profileSaved={applyCookProfile}
      signIn={accountsConfigured && !account ? () => setAuth(true) : undefined} />
    {notice?.error && <View style={[styles.notice, styles.noticeError]}><Copy accessibilityRole="alert">{notice.text}</Copy></View>}
    {authSheet}
  </>;

  const activeRecipe = (openedPost?.id === selected ? openedPost : undefined)
    ?? recipes.find((recipe) => recipe.id === selected) ?? discoveries.find((recipe) => recipe.id === selected);
  const activeRecipeLink = activeRecipe ? recipeShareLink(activeRecipe.id) : undefined;
  const shareRecipe = recipes.find((recipe) => recipe.id === share);
  const recipeEditable = Boolean(activeRecipe && recipes.some(recipe => recipe.id === activeRecipe.id)
    && !activeRecipe.discovery && !activeRecipe.id.startsWith('community:'));
  const exploreRecipes = feed === 'following' ? following ?? [] : [...featuredRecipes, ...community];
  const savedIds = new Set(collections?.flatMap(collection => collection.recipeIds) ?? []);
  const currentCollection = collections?.find(collection => collection.id === collectionId);
  function changeTab(next: Tab) {
    setSelected(undefined);
    if (next === 'saved' && tab === 'saved') setCollectionId(undefined);
    setTab(next);
    if (next === 'shopping') refreshShopping();
  }
  function startForm(state: FormState) {
    setAddMenu(false);
    setForm(state);
  }
  function openSocialRecipe(recipe: Recipe) {
    setBook(undefined);
    setCook(undefined);
    setOpenedPost(recipe);
    setSelected(recipe.id);
  }
  return <>
    <SafeAreaView edges={['top']} style={[styles.safe, activeRecipe && styles.covered]}
      accessibilityElementsHidden={Boolean(activeRecipe)} importantForAccessibility={activeRecipe ? 'no-hide-descendants' : 'auto'}
      aria-hidden={Boolean(activeRecipe)} pointerEvents={activeRecipe ? 'none' : 'auto'}>
      {!activeRecipe && <StatusBar style="dark" />}
      <View style={[styles.safe, tab !== 'explore' && styles.inactiveTab]} pointerEvents={tab === 'explore' ? 'auto' : 'none'}
        aria-hidden={tab !== 'explore'} importantForAccessibility={tab === 'explore' ? 'auto' : 'no-hide-descendants'}>
        <Library active={tab === 'explore'} recipes={exploreRecipes} savedIds={savedIds} onOpen={setSelected} onSave={setCollectionRecipe}
          social={{ feed, setFeed, openRecipe: openSocialRecipe, openBook: setBook, openCook: person => setCook({ id: person.user_id }),
            loading: feed === 'following' && following === undefined && !followingFailed,
            failed: feed === 'following' && followingFailed, retry: () => setFollowRevision(value => value + 1), revision: socialRevision }}
          personalization={account.personalization}
          preference={preference} onDiet={() => setDietSheet(true)}
          onDismissDiet={showDietPrompt ? () => void saveDiet('any').catch(showError) : undefined} />
      </View>
      {tab === 'saved' && <SavedCollections active={!activeRecipe} collections={collections} failed={collectionsFailed} retry={refreshCollections}
        current={currentCollection} recipes={recipes} openCollection={setCollectionId} openRecipe={setSelected} manageRecipe={setCollectionRecipe}
        create={() => setCollectionEditor({})} edit={collection => setCollectionEditor({ collection })} explore={() => changeTab('explore')}
        openHistory={() => { setHistoryOpen(true); void loadHistory(); }} />}
      {tab === 'shopping' && <ShoppingList items={shopping}
        status={shoppingStatus} retry={refreshShopping} onImport={legacyShopping.length ? () => setImportShopping(true) : undefined}
        onToggle={(ids) => void updateShopping((current) => {
          const selected = current.filter(item => ids.has(item.id));
          const checked = selected.some(item => !item.checked);
          return current.map(item => ids.has(item.id) ? { ...item, checked } : item);
        })}
        onRemove={(ids) => void updateShopping((current) => current.filter((item) => !ids.has(item.id)))}
        onClearChecked={() => void updateShopping((current) => current.filter((item) => !item.checked))}
        onExplore={() => changeTab('explore')} />}
      {tab === 'profile' && <Scene style={styles.safe}><CookProfile lookup={{ id: account.id }} account={account}
        edit={() => setEditCook(true)} openRecipe={openSocialRecipe}
        followChanged={() => setFollowRevision(value => value + 1)} openBook={setBook} createBook={() => setCreatingBook(true)}
        personal={{ recipes: recipes.filter(recipe => !recipe.discovery && !recipe.id.startsWith('community:')),
          open: setSelected, add: () => setAddMenu(true), settings: () => setAccountSettings(true),
          revision: profileRevision, section: profileSection, setSection: setProfileSection }} /></Scene>}
    </SafeAreaView>
    {activeRecipe && <RecipeScreen key={activeRecipe.id + activeRecipe.ingredients} recipe={activeRecipe}
      onAuthor={activeRecipe.discovery?.authorId ? () => setCook({ id: activeRecipe.discovery!.authorId! }) : undefined}
      reviewerId={account.id}
      onCooked={() => recordCooking(activeRecipe)} onReport={setReport}
      onShareLink={activeRecipeLink ? () => {
        void shareLink(activeRecipeLink, activeRecipe.title)
          .then(copied => { if (copied) setNotice({ text: 'Recipe link copied' }); }).catch(showError);
      } : undefined}
      allergens={account.personalization?.allergens}
      onBack={() => setSelected(undefined)} saved={savedIds.has(activeRecipe.id)} onSave={() => setCollectionRecipe(activeRecipe)}
      onAddIngredients={(indices) => addIngredients(activeRecipe, indices)}
      onEdit={recipeEditable ? () => setForm({ mode: 'manual', id: activeRecipe.id, draft: activeRecipe }) : undefined}
      onShare={recipeEditable && accountsConfigured ? () => {
        setShare(activeRecipe.id);
        if (!account) setAuth(true);
      } : undefined} />}
    {collectionRecipe && <SaveToCollections key={collectionRecipe.id} recipe={collectionRecipe} collections={collections}
      failed={collectionsFailed} retry={refreshCollections} close={() => setCollectionRecipe(undefined)}
      save={(add, remove, created) => updateRecipeCollections(collectionRecipe, add, remove, created)} />}
    {collectionEditor && <EditCollection collection={collectionEditor.collection} close={() => setCollectionEditor(undefined)}
      save={async (id, name) => {
        await saveCollection(account.id, id, name, !!collectionEditor.collection);
        await refreshCollections();
        if (accountRef.current?.id !== account.id) return;
        setCollectionId(id);
        setCollectionEditor(undefined);
      }}
      remove={async id => {
        await deleteCollection(account.id, id);
        await refreshCollections();
        if (accountRef.current?.id !== account.id) return;
        setCollectionId(undefined);
        setCollectionEditor(undefined);
      }} />}
    {cook && !editCook && !book && !creatingBook && <CookProfile lookup={cook} account={account} close={() => setCook(undefined)} edit={() => setEditCook(true)}
      openRecipe={openSocialRecipe} openBook={setBook} createBook={() => setCreatingBook(true)}
      followChanged={() => setFollowRevision(value => value + 1)} blocked={moderationChanged} />}
    {editCook && <ProfileEditor userId={account.id} close={() => setEditCook(false)} saved={profile => {
      applyCookProfile(profile);
      setEditCook(false);
      setProfileRevision(value => value + 1);
    }} />}
    {book && <BookSheet book={book} close={() => setBook(undefined)} openRecipe={openSocialRecipe}
      share={() => shareLink({ kind: 'book', id: book.id }, book.title)} />}
    {report && <ReportSheet target={report} close={() => setReport(undefined)} />}
    {historyOpen && <Sheet title="Cooking history" close={() => setHistoryOpen(false)}>
      {historyFailed && <Action secondary label="Retry cooking history" onPress={() => void loadHistory()} />}
      {!cooked && !historyFailed && <Copy accessibilityLiveRegion="polite">Opening your cooking history…</Copy>}
      {cooked?.length === 0 && <Copy>Recipes you mark as cooked will appear here.</Copy>}
      {cooked?.map(item => {
        const recipe = recipes.find(entry => entry.id === item.recipe_id);
        return recipe && <Action secondary key={item.recipe_id} label={recipe.title}
          onPress={() => { setHistoryOpen(false); setSelected(recipe.id); }} />;
      })}
    </Sheet>}
    {importShopping && <Sheet title="Import this device’s list?" close={() => setImportShopping(false)} busy={shoppingImport.busy}>
      <Copy>The items on this device will be added to your account and sync across your devices.</Copy>
      {shoppingImport.error && <Copy accessibilityRole="alert">{shoppingImport.error}</Copy>}
      <Action label={shoppingImport.busy ? 'Importing…' : 'Import list'} disabled={shoppingImport.busy}
        onPress={() => void shoppingImport.run(importDeviceList)} />
    </Sheet>}
    {creatingBook && <CreateBook userId={account.id} close={() => setCreatingBook(false)} saved={() => {
      setCreatingBook(false);
      setProfileRevision(value => value + 1);
      setProfileSection('books');
      setNotice({ text: 'Recipe book published' });
    }} />}
    {notice && <View style={[styles.notice, notice.error && styles.noticeError]}>
      <Copy accessibilityRole={notice.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.noticeText}>{notice.text}</Copy>
      {notice.undo && <Pressable accessibilityRole="button" onPress={notice.undo} style={styles.undo}><Copy style={styles.undoText}>Undo</Copy></Pressable>}
      {notice.viewList && <Pressable accessibilityRole="button" onPress={() => { setNotice(undefined); changeTab('shopping'); }} style={styles.undo}><Copy style={styles.undoText}>View list</Copy></Pressable>}
      {notice.persistent && <Pressable accessibilityRole="button" onPress={() => setNotice(undefined)} style={styles.undo}><Copy style={styles.undoText}>Dismiss</Copy></Pressable>}
    </View>}
    {!activeRecipe && <GlassNav tab={tab} onChange={changeTab} onAdd={() => setAddMenu(true)} adding={addMenu || Boolean(form)} />}
    {addMenu && <Sheet title="Add a recipe" close={() => setAddMenu(false)}>
      {draft && <Action label="Resume draft" onPress={() => startForm(draft)} />}
      <RecipeOption title="Import link" description="Bring a recipe you love into To Taste." icon="link" onPress={() => startForm({ mode: 'import' })} />
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
    {accountSettings && !settingsPage && !signInSettings && !deletePrompt && <Sheet title="Settings" busy={settings.busy} close={() => setAccountSettings(false)}>
      <SettingsGroup title="Account">
        <SettingsRow label="Sign-in methods" icon="profile" onPress={() => setSignInSettings(true)} />
        <SettingsRow label="Blocked accounts" icon="allergens" onPress={() => setSettingsPage('blocked')} />
        {guestRecipes.length > 0 && <SettingsRow label="Sync recipes from this device" icon="book" onPress={() => { setAccountSettings(false); setSyncPrompt(true); }} />}
      </SettingsGroup>
      <SettingsGroup title="Preferences">
        <SettingsRow label="Diet" icon="diet" value={dietOptions[account.diet]} onPress={() => setSettingsPage('diet')} />
        <SettingsRow label="Allergens" icon="allergens"
          value={account.personalization?.allergens.length ? `${account.personalization.allergens.length} selected` : 'None'}
          onPress={() => setSettingsPage('allergens')} />
        <SettingsRow label="Cooking style" icon="preferences"
          value={account.personalization?.cooking.length === 1 ? cookingStyles[account.personalization.cooking[0]]
            : account.personalization?.cooking.length ? `${account.personalization.cooking.length} selected` : cookingStyles.any}
          onPress={() => setSettingsPage('cooking')} />
      </SettingsGroup>
      <SettingsGroup title="Support">
        <SettingsRow label="Give feedback" icon="feedback" onPress={() => setSettingsPage('feedback')} />
        <SettingsRow label="Rate To Taste" icon="star" onPress={() => setSettingsPage('rating')} />
        <SettingsRow label="Help" icon="help" onPress={() => setSettingsPage('help')} />
      </SettingsGroup>
      <Action secondary label="Sign out" onPress={() => void settings.run(logout)} disabled={settings.busy} />
      <Action secondary label="Delete account" onPress={() => setDeletePrompt(true)} disabled={settings.busy} />
    </Sheet>}
    {accountSettings && (settingsPage === 'diet' || settingsPage === 'allergens' || settingsPage === 'cooking') &&
      <PreferenceSettings key={settingsPage} page={settingsPage} initialDiet={account.diet} initial={account.personalization ?? { allergens: [], cooking: [] }}
        back={() => setSettingsPage(undefined)} saveDiet={saveDiet} savePreferences={updatePersonalization} />}
    {accountSettings && (settingsPage === 'feedback' || settingsPage === 'rating' || settingsPage === 'help') &&
      <SupportSettings key={settingsPage} page={settingsPage} back={() => setSettingsPage(undefined)} />}
    {accountSettings && settingsPage === 'blocked' && <BlockedAccounts back={() => setSettingsPage(undefined)} changed={moderationChanged} />}
    {accountSettings && signInSettings && !deletePrompt && <Sheet title="Sign-in methods" busy={settings.busy} back={() => setSignInSettings(false)}>
      <Copy>Add a sign-in method to the account you’re using now.</Copy>
      {(['apple', 'google'] as const).map(provider => <Action key={provider} secondary label={provider === 'apple' ? 'Link Apple' : 'Link Google'}
        disabled={settings.busy} onPress={() => void settings.run(async () => {
          await prepareAuth('link');
          if (await signInWithProvider(provider, true)) {
            await AsyncStorage.removeItem(intentKey);
            setSignInSettings(false);
            setNotice({ text: 'Sign-in method updated' });
          }
        })} />)}
      {settings.error ? <Copy accessibilityRole="alert">{settings.error}</Copy> : null}
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
        setProfileRevision(value => value + 1);
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
        setProfileRevision(value => value + 1);
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
