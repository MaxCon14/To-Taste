import { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, TextInput, View } from 'react-native';
import { Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { readCommunity, type Account } from './cookbookApi';
import type { Recipe } from './recipes';
import { readCook, readFollow, saveCook, searchCooks, setFollow, type Cook, type CookLookup } from './socialApi';
import { Action, color, Copy, Cover, font } from './ui';

export function FindCooks({ close, open }: { close: () => void; open: (cook: CookLookup) => void }) {
  const [query, setQuery] = useState('');
  const [cooks, setCooks] = useState<Cook[]>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setCooks(undefined);
    const timer = setTimeout(() => {
      void searchCooks(query).then(data => { if (active) setCooks(data); })
        .catch(() => { if (active) setFailed(true); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, retry]);
  return <Sheet title="Find cooks" close={close}>
    <TextInput accessibilityLabel="Name or handle" placeholder="Search by name or @handle" autoCapitalize="none"
      autoCorrect={false} value={query} onChangeText={setQuery} style={styles.input} />
    {failed ? <Action secondary label="Retry search" onPress={() => setRetry(retry + 1)} /> : !cooks
      ? <Copy accessibilityLiveRegion="polite" style={styles.secondary}>Searching…</Copy>
      : !cooks.length ? <Copy style={styles.secondary}>{query.trim() ? 'No cooks match that search.' : 'Public profiles will appear here.'}</Copy>
        : cooks.map(cook => <MotionPressable key={cook.user_id} accessibilityRole="button" onPress={() => open({ id: cook.user_id })} style={styles.row}>
          <Avatar name={cook.name} />
          <View style={styles.text}><Copy style={styles.name}>{cook.name}</Copy><Copy style={styles.secondary}>@{cook.handle}</Copy></View>
          <Glyph name="forward" color={color.secondaryInk} size={17} />
        </MotionPressable>)}
  </Sheet>;
}

export function CookProfile({ lookup, account, close, edit, openRecipe, followChanged }: {
  lookup: CookLookup; account: Account; close: () => void; edit: () => void;
  openRecipe: (recipe: Recipe) => void; followChanged: () => void;
}) {
  const [data, setData] = useState<{ cook: Cook | null; posts: Recipe[]; following: boolean }>();
  const { busy, error, run } = useSubmission();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setFailed(false);
    void readCook(lookup).then(async cook => {
      const id = cook?.user_id ?? ('id' in lookup ? lookup.id : undefined);
      const [posts, following] = await Promise.all([id ? readCommunity(id) : [], cook ? readFollow(cook.user_id) : false]);
      if (active) setData({ cook, posts, following });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [lookup, retry]);
  const cook = data?.cook;
  const own = cook?.user_id === account.id || ('id' in lookup && lookup.id === account.id);
  const link = cook ? `https://pinch-recipe-preview.max-constantinou.chatgpt.site/?cook=${cook.handle}` : undefined;
  return <Sheet title={cook?.name ?? 'Cook profile'} close={close} busy={busy}>
    {failed ? <Action secondary label="Retry profile" onPress={() => setRetry(retry + 1)} /> : !data
      ? <Copy accessibilityLiveRegion="polite" style={styles.secondary}>Opening profile…</Copy> : <>
      {cook ? <>
        <View style={styles.row}><Avatar name={cook.name} /><Copy style={styles.secondary}>@{cook.handle}</Copy></View>
        {!!cook.bio && <Copy style={styles.bio}>{cook.bio}</Copy>}
        {own ? <Action label="Edit public profile" onPress={edit} /> : <Action label={data.following ? 'Unfollow' : 'Follow'}
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
        {link && Platform.OS === 'web' && <Copy selectable style={styles.secondary}>{link}</Copy>}
      </> : own ? <Action label="Create public profile" onPress={edit} /> : <Copy style={styles.secondary}>{'handle' in lookup ? 'That handle was not found.' : 'This cook hasn’t set up a public profile yet.'}</Copy>}
      <Copy accessibilityRole="header" style={styles.heading}>Published recipes</Copy>
      {!data.posts.length && <Copy style={styles.secondary}>No published recipes yet.</Copy>}
      {data.posts.map(recipe => <MotionPressable key={recipe.id} accessibilityRole="button" onPress={() => openRecipe(recipe)} style={styles.row}>
        <View style={styles.cover}><Cover recipe={recipe} /></View>
        <Copy style={[styles.text, styles.name]}>{recipe.title}</Copy>
        <Glyph name="forward" color={color.secondaryInk} size={17} />
      </MotionPressable>)}
    </>}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
  </Sheet>;
}

export function EditCook({ account, close, saved }: { account: Account; close: () => void; saved: () => void }) {
  const [existing, setExisting] = useState<Cook | null>();
  const [name, setName] = useState(account.name);
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const { busy, error, run } = useSubmission();
  useEffect(() => {
    let active = true;
    void run(async () => {
      try {
        const cook = await readCook({ id: account.id });
        if (!active) return;
        setExisting(cook);
        if (cook) { setName(cook.name); setHandle(cook.handle); setBio(cook.bio); }
      } catch { throw new Error('Couldn’t open your profile. Close and try again.'); }
    });
    return () => { active = false; };
  }, [account.id]);
  return <Sheet title="Your public profile" close={close} busy={busy}>
    <Copy style={styles.secondary}>Your name, handle and bio will be visible to anyone who opens your profile.</Copy>
    {existing !== undefined && <>
      <Copy style={styles.name}>Display name</Copy>
      <TextInput accessibilityLabel="Display name" value={name} onChangeText={setName} maxLength={60} editable={!busy} style={styles.input} />
      <Copy style={styles.name}>Handle</Copy>
      <TextInput accessibilityLabel="Handle" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false}
        placeholder="your_handle" maxLength={25} editable={!busy} style={styles.input} />
      <Copy style={styles.secondary}>3–24 characters. Use letters, numbers or underscores.</Copy>
      <Copy style={styles.name}>Bio</Copy>
      <TextInput accessibilityLabel="Bio" value={bio} onChangeText={setBio} placeholder="What do you like to cook?"
        multiline maxLength={280} editable={!busy} style={[styles.input, styles.bioInput]} />
      <Action label="Save public profile" disabled={busy} onPress={() => void run(async () => {
        const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
        if (!name.trim()) throw new Error('Enter a display name.');
        if (!/^[a-z0-9][a-z0-9_]{2,23}$/.test(cleanHandle)) throw new Error('Choose a valid handle that starts with a letter or number.');
        await saveCook({ name: name.trim(), handle: cleanHandle, bio: bio.trim() }, !!existing, account.id);
        saved();
      })} />
    </>}
    {busy && existing === undefined && <Copy style={styles.secondary}>Opening your profile…</Copy>}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
  </Sheet>;
}

function Avatar({ name }: { name: string }) {
  return <View style={styles.avatar}><Copy style={styles.initial}>{[...name.trim()][0]?.toUpperCase()}</Copy></View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 8, borderRadius: 16, backgroundColor: color.muted },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: font.bold, color: color.white, fontSize: 18 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: font.bold, fontSize: 15 },
  secondary: { color: color.secondaryInk, fontSize: 14, lineHeight: 20 },
  heading: { fontFamily: font.bold, fontSize: 20, marginTop: 8 },
  bio: { lineHeight: 23 },
  input: { minHeight: 48, borderRadius: 13, backgroundColor: color.muted, color: color.ink, padding: 12, fontFamily: font.body, fontSize: 16 },
  bioInput: { minHeight: 88, textAlignVertical: 'top' },
  cover: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden' },
  error: { color: color.error },
});
