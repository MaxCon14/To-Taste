import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { readCommunity, type Account } from './cookbookApi';
import { emptyDraft, type Recipe } from './recipes';
import { readCook, readCookBooks, readFollow, saveCook, setFollow, type Banner, type Cook, type CookLookup, type RecipeBook } from './socialApi';
import { Action, color, Copy, Cover, font, IconButton, Segment, segmentTrack } from './ui';
import { CollectionRow } from './RecipeBooks';

const banners: Record<Banner, string> = { pasta: 'Tomato pasta', chicken: 'Lemon chicken', pancakes: 'Pancakes', chickpeas: 'Chickpeas', salmon: 'Salmon' };

function profileUrl(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  const url = new URL(clean);
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password || url.href.length > 300) throw new Error();
  return url.href;
}

export function CookProfile({ lookup, account, close, edit, openRecipe, followChanged, openBook, createBook, personal }: {
  lookup: CookLookup; account: Account; close?: () => void; edit: () => void;
  openRecipe: (recipe: Recipe) => void; followChanged: () => void;
  openBook: (book: RecipeBook) => void; createBook: () => void;
  personal?: { recipes: Recipe[]; open: (id: string) => void; add: () => void; settings: () => void; revision: number; section: 'posts' | 'recipes' | 'books'; setSection: (section: 'posts' | 'recipes' | 'books') => void };
}) {
  const [data, setData] = useState<{ cook: Cook | null; posts: Recipe[]; following: boolean; books: RecipeBook[] }>();
  const { busy, error, run } = useSubmission();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const revision = personal?.revision;
  const lookupId = 'id' in lookup ? lookup.id : undefined;
  const lookupHandle = 'handle' in lookup ? lookup.handle : undefined;
  useEffect(() => {
    let active = true;
    setData(undefined);
    setFailed(false);
    void readCook(lookupId ? { id: lookupId } : { handle: lookupHandle! }).then(async cook => {
      const id = cook?.user_id ?? lookupId;
      const [posts, following, books] = await Promise.all([id ? readCommunity(id) : [], cook ? readFollow(cook.user_id) : false, cook ? readCookBooks(cook.user_id) : []]);
      if (active) setData({ cook, posts, following, books });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [lookupId, lookupHandle, retry, revision]);
  const cook = data?.cook;
  const own = cook?.user_id === account.id || ('id' in lookup && lookup.id === account.id);
  const link = cook ? `https://pinch-recipe-preview.max-constantinou.chatgpt.site/?cook=${cook.handle}` : undefined;
  const section = personal?.section ?? 'posts';
  const posts = section === 'recipes' ? personal?.recipes ?? [] : data?.posts ?? [];
  const content = <>
    {personal && <View style={styles.profileTop}>
      <Copy accessibilityRole="header" style={styles.profileTitle}>Profile</Copy>
      <IconButton label="Settings" onPress={personal.settings}><Glyph name="settings" color={color.ink} size={21} /></IconButton>
    </View>}
    {failed ? <Action secondary label="Retry profile" onPress={() => setRetry(retry + 1)} /> : !data
      ? <Copy accessibilityLiveRegion="polite" style={styles.secondary}>Opening profile…</Copy> : <>
      {cook ? <>
        <View>
          <View style={styles.banner} aria-hidden><Cover recipe={{ ...emptyDraft, cover: cook.banner }} /></View>
          <View style={styles.identity}>
            <View style={styles.avatarRing}><Avatar name={cook.name} /></View>
            <Copy accessibilityRole="header" style={styles.profileName}>{cook.name}</Copy>
            <Copy style={styles.secondary}>@{cook.handle}</Copy>
          </View>
        </View>
        {!!cook.bio && <Copy style={styles.bio}>{cook.bio}</Copy>}
        {[['Website', cook.website], ['Social link', cook.social_link]].filter(([, url]) => !!url).map(([label, url]) =>
          <MotionPressable key={label} accessibilityRole="link" accessibilityLabel={label} style={styles.link}
            onPress={() => void run(async () => { await Linking.openURL(profileUrl(url)); })}>
            <Glyph name="link" color={color.ink} size={15} /><Copy style={styles.linkText}>{label}</Copy><Glyph name="external" color={color.secondaryInk} size={14} />
          </MotionPressable>)}
        <View style={styles.profileActions}>
        {own ? <Action secondary label="Edit profile" onPress={edit} /> : <Action label={data.following ? 'Unfollow' : 'Follow'}
          secondary={data.following} disabled={busy} onPress={() => void run(async () => {
            await setFollow(cook.user_id, !data.following);
            setData({ ...data, following: !data.following });
            followChanged();
          })} />}
        {!!link && <Action secondary label="Share profile" disabled={busy} onPress={() => void run(async () => {
          if (Platform.OS !== 'web') { await Share.share({ message: link }); return; }
          if (navigator.share) {
            try { await navigator.share({ title: cook.name, url: link }); }
            catch (cause) { if (!(cause instanceof Error && cause.name === 'AbortError')) throw cause; }
          } else await navigator.clipboard.writeText(link);
        })}><Glyph name="share" color={color.ink} size={17} /></Action>}
        </View>
      </> : own ? <Action label="Create public profile" onPress={edit} /> : <Copy style={styles.secondary}>{'handle' in lookup ? 'That handle was not found.' : 'This cook hasn’t set up a public profile yet.'}</Copy>}
      {personal && <View style={segmentTrack}>
        <Segment label="Posts" active={section === 'posts'} onPress={() => personal.setSection('posts')} />
        <Segment label="My recipes" active={section === 'recipes'} onPress={() => personal.setSection('recipes')} />
        <Segment label="Books" active={section === 'books'} onPress={() => personal.setSection('books')} />
      </View>}
      {(section === 'books' || (!personal && (own && cook || data.books.length > 0))) && <>
        <Copy accessibilityRole="header" style={styles.heading}>Recipe books</Copy>
        {data.books.map(book => <CollectionRow key={book.id} book={book} open={() => openBook(book)} />)}
        {!data.books.length && <Copy style={styles.secondary}>Collect your published recipes into a book.</Copy>}
        {own && <Action secondary label="Create recipe book" disabled={!data.posts.length} onPress={createBook} />}
      </>}
      {section !== 'books' && <>
      {section === 'recipes' && <Copy style={styles.secondary}>Only you can see this list. Open a recipe to edit or publish it.</Copy>}
      {!personal && <Copy accessibilityRole="header" style={styles.heading}>Published recipes</Copy>}
      {!posts.length && <View style={styles.empty}>
        <Copy style={styles.name}>{section === 'recipes' ? 'No recipes yet' : 'No posts yet'}</Copy>
        {personal && <Copy style={styles.secondary}>{section === 'recipes' ? 'Add a recipe to start your cookbook.' : 'Publish a recipe from My recipes to share it on your profile.'}</Copy>}
        {personal && <Action secondary label={section === 'recipes' ? 'Add a recipe' : 'Open My recipes'}
          onPress={section === 'recipes' ? personal.add : () => personal.setSection('recipes')} />}
      </View>}
      <View style={[styles.grid, !personal && styles.visitorGrid]}>
      {posts.map(recipe => <MotionPressable key={recipe.id} accessibilityRole="button" onPress={() => section === 'recipes' && personal ? personal.open(recipe.id) : openRecipe(recipe)} style={styles.recipeCard}>
        <View style={styles.cover}><Cover recipe={recipe} /></View>
        <Copy style={styles.recipeName}>{recipe.title}</Copy>
      </MotionPressable>)}
      </View>
      </>}
    </>}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
  </>;
  return personal ? <ScrollView contentContainerStyle={styles.profilePage}>{content}</ScrollView>
    : <Sheet title={cook?.name ?? 'Cook profile'} close={close} busy={busy}>{content}</Sheet>;
}

export function EditCook({ account, close, saved, duringSignup = false }: {
  account: Account; close?: () => void; saved: (cook: Cook) => void; duringSignup?: boolean;
}) {
  const [existing, setExisting] = useState<Cook | null>();
  const [name, setName] = useState(account.name);
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [banner, setBanner] = useState<Banner>('pasta');
  const [website, setWebsite] = useState('');
  const [social, setSocial] = useState('');
  const [retry, setRetry] = useState(0);
  const { busy, error, run } = useSubmission();
  useEffect(() => {
    let active = true;
    void run(async () => {
      try {
        const cook = await readCook({ id: account.id });
        if (!active) return;
        setExisting(cook);
        if (cook) { setName(cook.name); setHandle(cook.handle); setBio(cook.bio); setBanner(cook.banner); setWebsite(cook.website); setSocial(cook.social_link); }
      } catch { throw new Error('Couldn’t open your profile. Try again.'); }
    });
    return () => { active = false; };
  }, [account.id, retry]);
  return <Sheet title={duringSignup ? 'Choose your username' : 'Your public profile'} close={close} busy={busy}>
    <Copy style={styles.secondary}>{duringSignup ? 'People can find you by your username and display name.' : 'Your name, username and bio will be visible to anyone who opens your profile.'}</Copy>
    {existing !== undefined && <>
      <Copy style={styles.name}>Display name</Copy>
      <TextInput accessibilityLabel="Display name" value={name} onChangeText={setName} maxLength={60} editable={!busy} style={styles.input} />
      <Copy style={styles.name}>Username</Copy>
      <TextInput accessibilityLabel="Username" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false}
        placeholder="your_username" maxLength={25} editable={!busy} style={styles.input} />
      <Copy style={styles.secondary}>3–24 characters. Use letters, numbers or underscores.</Copy>
      {!duringSignup && <><Copy style={styles.name}>Bio</Copy>
      <TextInput accessibilityLabel="Bio" value={bio} onChangeText={setBio} placeholder="What do you like to cook?"
        multiline maxLength={280} editable={!busy} style={[styles.input, styles.bioInput]} />
      <Copy style={styles.name}>Banner</Copy>
      <View style={styles.bannerChoices}>{(Object.keys(banners) as Banner[]).map(option =>
        <MotionPressable key={option} accessibilityRole="radio" accessibilityLabel={banners[option]} aria-checked={banner === option}
          disabled={busy} onPress={() => setBanner(option)} style={[styles.bannerChoice, banner === option && styles.bannerSelected]}>
          <Cover recipe={{ ...emptyDraft, cover: option }} />
        </MotionPressable>)}</View>
      <Copy style={styles.name}>Website</Copy>
      <TextInput accessibilityLabel="Website" value={website} onChangeText={setWebsite} placeholder="https://…" keyboardType="url"
        autoCapitalize="none" autoCorrect={false} maxLength={300} editable={!busy} style={styles.input} />
      <Copy style={styles.name}>Social link</Copy>
      <TextInput accessibilityLabel="Social link" value={social} onChangeText={setSocial} placeholder="https://…" keyboardType="url"
        autoCapitalize="none" autoCorrect={false} maxLength={300} editable={!busy} style={styles.input} /></>}
      <Action label={duringSignup ? 'Continue' : 'Save public profile'} disabled={busy} onPress={() => void run(async () => {
        const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
        if (!name.trim()) throw new Error('Enter a display name.');
        if (!/^[a-z0-9][a-z0-9_]{2,23}$/.test(cleanHandle)) throw new Error('Choose a valid handle that starts with a letter or number.');
        let links = {};
        if (!duringSignup) {
          try { links = { banner, website: profileUrl(website), social_link: profileUrl(social) }; }
          catch { throw new Error('Enter full HTTPS links, or leave those fields blank.'); }
        }
        saved(await saveCook({ name: name.trim(), handle: cleanHandle, bio: bio.trim(), ...links }, !!existing, account.id));
      })} />
    </>}
    {busy && existing === undefined && <Copy style={styles.secondary}>Opening your profile…</Copy>}
    {!busy && existing === undefined && !!error && <Action secondary label="Retry profile" onPress={() => setRetry(value => value + 1)} />}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
  </Sheet>;
}

function Avatar({ name }: { name: string }) {
  return <View style={styles.avatar}><Copy style={styles.initial}>{[...name.trim()][0]?.toUpperCase()}</Copy></View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 8, borderRadius: 16, backgroundColor: color.muted },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: font.bold, color: color.white, fontSize: 18 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: font.bold, fontSize: 15 },
  secondary: { color: color.secondaryInk, fontSize: 14, lineHeight: 20 },
  heading: { fontFamily: font.bold, fontSize: 20, marginTop: 8 },
  bio: { lineHeight: 23 },
  input: { minHeight: 48, borderRadius: 13, backgroundColor: color.muted, color: color.ink, padding: 12, fontFamily: font.body, fontSize: 16 },
  bioInput: { minHeight: 88, textAlignVertical: 'top' },
  profilePage: { width: '100%', maxWidth: 650, alignSelf: 'center', padding: 20, paddingBottom: 120, gap: 14 },
  profileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileTitle: { fontFamily: font.bold, fontSize: 21 },
  banner: { height: 142, borderRadius: 22, overflow: 'hidden', backgroundColor: color.muted },
  identity: { alignItems: 'flex-start', paddingHorizontal: 12, gap: 4 },
  avatarRing: { marginTop: -30, borderWidth: 4, borderColor: color.surface, borderRadius: 32 },
  profileName: { fontFamily: font.bold, fontSize: 28, letterSpacing: -0.7 },
  profileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { fontFamily: font.medium, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  visitorGrid: { marginTop: 4 },
  recipeCard: { width: '48.5%', borderRadius: 16, overflow: 'hidden', backgroundColor: color.muted },
  cover: { width: '100%', aspectRatio: 1.15, overflow: 'hidden' },
  recipeName: { paddingHorizontal: 10, paddingVertical: 12, fontFamily: font.bold, fontSize: 15 },
  empty: { padding: 16, gap: 8, borderRadius: 16, backgroundColor: color.muted },
  bannerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bannerChoice: { width: 72, height: 46, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: color.rule },
  bannerSelected: { borderColor: color.ink },
  error: { color: color.error },
});
