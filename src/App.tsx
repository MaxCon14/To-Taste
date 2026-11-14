import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GlassNav, type Tab } from './GlassNav';
import { MotionProvider, Scene, WebPolish } from './motion';
import { Library, type Filter } from './Library';
import { Onboarding } from './Onboarding';
import { RecipeForm, type FormState } from './RecipeForm';
import { RecipeScreen } from './RecipeScreen';
import { featuredRecipes, lines, type Diet, type Recipe, type RecipeDraft } from './recipes';
import { ShoppingList, type ShoppingItem } from './ShoppingList';
import { Action, color, Copy, font } from './ui';
import { AccountSheet, DietSheet, Profile, RecipeOption, ShareSheet, Sheet, type ShareOptions } from './FlowSheets';
import { pinchApi, signIn, signOut, type Account, type AccountMode, type Session, type SubmitAccount } from './pinchApi';

const storageKey = 'pinch.recipes.v1';
const preferenceKey = 'pinch.preference.v1';
const shoppingKey = 'pinch.shopping.v1';
const onboardingPendingKey = 'pinch.onboarding.pending.v1';

type Notice = { text: string; undo?: () => void; viewList?: boolean; error?: boolean };
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
  const [resumeOnboarding, setResumeOnboarding] = useState(false);
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
  const [auth, setAuth] = useState<AccountMode>();
  const [share, setShare] = useState<string>();
  const [published, setPublished] = useState<Record<string, ShareOptions>>({});
  const [community, setCommunity] = useState<Recipe[]>([]);
  const latest = useRef<Recipe[]>([]);
  const writes = useRef(Promise.resolve());
  const draftWrites = useRef(Promise.resolve());
  const accountRef = useRef<Account | null>(null);
  const ready = recipes !== undefined;

  function showError(error: unknown) {
    setNotice({ text: error instanceof Error ? error.message : 'Something went wrong. Try again.', error: true });
  }

  useEffect(() => {
    let active = true;
    setReadFailed(false);
    void Promise.all([
      AsyncStorage.getItem(storageKey), AsyncStorage.getItem(preferenceKey),
      pinchApi<Session>('session').catch(() => null),
      AsyncStorage.getItem(shoppingKey),
      AsyncStorage.getItem(onboardingPendingKey),
    ]).then(async ([saved, localDiet, session, storedShopping, pendingOnboarding]) => {
      const data: unknown = saved === null ? [] : JSON.parse(saved);
      if (!Array.isArray(data) || !data.every((recipe) => recipe
        && typeof recipe.id === 'string' && typeof recipe.title === 'string' && typeof recipe.ingredients === 'string'
        && typeof recipe.instructions === 'string' && typeof recipe.minutes === 'string' && typeof recipe.servings === 'string')) {
        throw new Error('Invalid recipe data');
      }
      const user = session?.user ?? null;
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
      if (user) {
        setPreference(user.diet);
        if (pendingOnboarding === user.id) {
          setResumeOnboarding(true);
          setOnboarding(true);
        }
      }
      else if (localDiet === 'any' || localDiet === 'vegan' || localDiet === 'vegetarian' || localDiet === 'pescatarian') setPreference(localDiet);
      else if (!data.length && !savedDraft) setOnboarding(true);
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

  function addIngredients(recipe: Recipe) {
    let added = 0;
    void updateShopping((current) => {
      const existing = new Set(current.map((item) => item.id));
      const items = lines(recipe.ingredients).map((line, index): ShoppingItem => ({
        id: JSON.stringify([recipe.id, index, line]), line, recipe: recipe.title, checked: false,
      })).filter((item) => !existing.has(item.id));
      added = items.length;
      return added ? [...current, ...items] : current;
    }).then(() => setNotice({
      text: added ? `Added ${added} ${added === 1 ? 'ingredient' : 'ingredients'} to your list` : 'These ingredients are already on your list',
      viewList: true,
    })).catch(() => {});
  }

  function refreshCommunity() {
    void pinchApi<Recipe[]>('community').then(setCommunity).catch(() => {});
  }

  useEffect(() => {
    if (ready && !onboarding && tab === 'explore') refreshCommunity();
  }, [ready, onboarding, tab]);

  useEffect(() => {
    let active = true;
    if (account) void pinchApi<Record<string, ShareOptions>>('share').then((posts) => { if (active) setPublished(posts); }).catch(() => {});
    else setPublished({});
    return () => { active = false; };
  }, [account?.id]);

  useEffect(() => {
    if (!notice || notice.error) return;
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
        await pinchApi('recipe', recipe ? 'PUT' : 'DELETE', recipe ?? { id });
      } else {
        try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); }
        catch { throw new Error('To Taste couldn’t save changes to this device. Try again.'); }
      }
      latest.current = next;
      setRecipes(next);
    });
    writes.current = operation.catch(() => {});
    return operation;
  }

  const discoveries = [...featuredRecipes, ...community];

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
      .then(() => setNotice({ text: 'Saved to your recipe book', undo: () => removeDiscovery(recipe) })).catch(showError);
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
    if (account && account.diet !== diet) {
      const updated = await pinchApi<Account>('preferences', 'PUT', { diet });
      accountRef.current = updated;
      setAccount(updated);
    } else if (!account) await AsyncStorage.setItem(preferenceKey, diet);
    setPreference(diet);
    setDietSheet(false);
  }

  async function finishOnboarding(diet: Diet) {
    await saveDiet(diet);
    await AsyncStorage.removeItem(onboardingPendingKey);
    setResumeOnboarding(false);
    setTab('explore');
    setOnboarding(false);
  }

  const submitAccount: SubmitAccount = (mode, fields) => signIn(mode, { ...fields, diet: preference });

  async function applySession(session: Session) {
    const user = session.user;
    if (!user) throw new Error('To Taste couldn’t open your account. Try signing in again.');
    await writes.current;
    const guest = latest.current;
    let synced = session.recipes;
    if (guest.length) {
      try {
        for (let start = 0; start < guest.length; start += 10) {
          synced = await pinchApi<Recipe[]>('merge', 'POST', { recipes: guest.slice(start, start + 10) });
        }
        await AsyncStorage.removeItem(storageKey);
      } catch (error) { showError(error); }
    }
    accountRef.current = user;
    setAccount(user);
    setPreference(user.diet);
    latest.current = synced;
    setRecipes(synced);
    setDraft(await readDraft(user).catch(() => undefined));
    setAuth(undefined);
  }

  async function logout() {
    try {
      await writes.current;
      const [saved, guestDraft, guestDiet] = await Promise.all([AsyncStorage.getItem(storageKey), readDraft(null), AsyncStorage.getItem(preferenceKey)]);
      await signOut();
      if (guestDiet === null) void AsyncStorage.setItem(preferenceKey, 'any').catch(showError);
      accountRef.current = null;
      setAccount(null);
      latest.current = saved ? JSON.parse(saved) : [];
      setRecipes(latest.current);
      setDraft(guestDraft);
      setPreference(guestDiet === 'vegan' || guestDiet === 'vegetarian' || guestDiet === 'pescatarian' ? guestDiet : 'any');
      setNotice({ text: 'Signed out' });
    } catch (error) { showError(error); }
  }

  if (!recipes) return <View style={styles.center}>
    {readFailed ? <>
      <Copy accessibilityRole="alert">To Taste couldn’t open your recipe book.</Copy>
      <Action label="Try again" onPress={() => setLoadAttempt((attempt) => attempt + 1)} />
    </> : <ActivityIndicator color={color.secondaryInk} />}
  </View>;

  if (onboarding) return <Onboarding accountName={account?.name} initialDiet={preference} resumeDiet={resumeOnboarding} onSubmit={submitAccount} onSignedIn={async (session, mode) => {
    if (mode === 'register' && session.user) await AsyncStorage.setItem(onboardingPendingKey, session.user.id);
    await applySession(session);
    if (mode === 'login') {
      setTab('explore');
      setOnboarding(false);
    }
  }} finish={finishOnboarding} />;

  const activeRecipe = recipes.find((recipe) => recipe.id === selected) ?? discoveries.find((recipe) => recipe.id === selected);
  const shareRecipe = recipes.find((recipe) => recipe.id === share);
  const recipeSaved = Boolean(activeRecipe && recipes.some((recipe) => recipe.id === activeRecipe.id));
  const recipeEditable = recipeSaved && activeRecipe?.discovery?.author === undefined && !activeRecipe?.id.startsWith('community:');
  const exploreRecipes = discoveries.map((recipe) => ({ ...recipe, favorite: recipes.find((saved) => saved.id === recipe.id)?.favorite ?? false }));
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
          preference={preference} onDiet={() => setDietSheet(true)} onAdd={() => setAddMenu(true)} />
      </View>
      <View style={[styles.safe, !libraryActive && styles.inactiveTab]} pointerEvents={libraryActive ? 'auto' : 'none'}
        aria-hidden={!libraryActive} importantForAccessibility={libraryActive ? 'auto' : 'no-hide-descendants'}>
        <Library active={libraryActive} recipes={recipes} filter={filter} setFilter={setFilter} onOpen={setSelected} onFavorite={favorite}
          preference={preference} onDiet={() => setDietSheet(true)} onAdd={() => setAddMenu(true)} />
      </View>
      {tab === 'shopping' && <ShoppingList items={shopping}
        onToggle={(id) => void updateShopping((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item))}
        onRemove={(id) => void updateShopping((current) => current.filter((item) => item.id !== id))}
        onClearChecked={() => void updateShopping((current) => current.filter((item) => !item.checked))}
        onExplore={() => changeTab('explore')} />}
      {tab === 'profile' && <Scene style={styles.safe}><Profile account={account} diet={preference} onDiet={() => setDietSheet(true)} onAuth={setAuth} onLogout={() => void logout()}
        onReplayWelcome={() => { setResumeOnboarding(false); setOnboarding(true); }} /></Scene>}
    </SafeAreaView>
    {activeRecipe && <RecipeScreen key={activeRecipe.id + activeRecipe.ingredients} recipe={activeRecipe}
      onBack={() => setSelected(undefined)} onFavorite={() => favorite(activeRecipe.id)}
      onAddIngredients={() => addIngredients(activeRecipe)}
      onSave={!recipeSaved ? () => saveDiscovery(activeRecipe) : undefined}
      onRemove={recipeSaved && !recipeEditable ? () => removeDiscovery(activeRecipe) : undefined}
      onEdit={recipeEditable ? () => setForm({ mode: 'manual', id: activeRecipe.id, draft: activeRecipe }) : undefined}
      onShare={recipeEditable ? () => {
        setShare(activeRecipe.id);
        if (!account) setAuth('register');
      } : undefined} />}
    {notice && <View style={[styles.notice, notice.error && styles.noticeError]}>
      <Copy accessibilityRole={notice.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.noticeText}>{notice.text}</Copy>
      {notice.undo && <Pressable accessibilityRole="button" onPress={notice.undo} style={styles.undo}><Copy style={styles.undoText}>Undo</Copy></Pressable>}
      {notice.viewList && <Pressable accessibilityRole="button" onPress={() => { setNotice(undefined); changeTab('shopping'); }} style={styles.undo}><Copy style={styles.undoText}>View list</Copy></Pressable>}
    </View>}
    {!activeRecipe && <GlassNav tab={tab} onChange={changeTab} onAdd={() => setAddMenu(true)} adding={addMenu || Boolean(form)} />}
    {addMenu && <Sheet title="Add a recipe" close={() => setAddMenu(false)}>
      {draft && <Action label="Resume draft" onPress={() => startForm(draft)} />}
      <RecipeOption title="Import link" description="Bring a recipe you love into To Taste." icon="link" onPress={() => startForm({ mode: 'import' })} />
      <RecipeOption title="Write a recipe" description="Your ingredients. Your way." icon="edit" onPress={() => startForm({ mode: 'manual' })} />
    </Sheet>}
    {form && <RecipeForm state={form} close={() => setForm(undefined)} save={save} remove={remove} onDraft={form.id ? undefined : rememberDraft} />}
    {dietSheet && <DietSheet initial={preference} close={() => setDietSheet(false)} save={saveDiet} />}
    {auth && <AccountSheet initialMode={auth} sharing={Boolean(share)} close={() => { setAuth(undefined); setShare(undefined); }}
      onSubmit={submitAccount} onSignedIn={applySession} />}
    {!auth && account && shareRecipe && <ShareSheet account={account} recipe={shareRecipe} close={() => setShare(undefined)} published={published[shareRecipe.id]}
      unpublish={async () => {
        await pinchApi('share', 'DELETE', { id: shareRecipe.id });
        forgetPost(shareRecipe.id);
        setShare(undefined);
        setNotice({ text: 'Removed from Explore' });
        refreshCommunity();
      }}
      share={async (diet, onePan, weekend) => {
        await pinchApi('share', 'POST', { id: shareRecipe.id, diet, onePan, weekend });
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
