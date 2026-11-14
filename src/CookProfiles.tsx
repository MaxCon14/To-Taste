import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { readCommunity, type Account } from './cookbookApi';
import type { Recipe } from './recipes';
import { readCook, readCookBooks, readFollow, setFollow, type Cook, type CookLookup, type RecipeBook } from './socialApi';
import { ProfileAvatar, ProfileBanner, profileUrl } from './ProfileEditor';
import { profileImageUrl } from './profilePhotos';
import { Action, color, Copy, Cover, font, IconButton, Segment, segmentTrack } from './ui';
import { CollectionRow } from './RecipeBooks';

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
          <View style={styles.banner} aria-hidden><ProfileBanner banner={cook.banner} uri={profileImageUrl(cook.banner_image)} /></View>
          <View style={styles.identity}>
            <View style={styles.avatarRing}><ProfileAvatar name={cook.name} uri={profileImageUrl(cook.avatar_image)} /></View>
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

const styles = StyleSheet.create({
  name: { fontFamily: font.bold, fontSize: 15 },
  secondary: { color: color.secondaryInk, fontSize: 14, lineHeight: 20 },
  heading: { fontFamily: font.bold, fontSize: 20, marginTop: 8 },
  bio: { lineHeight: 23 },
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
  error: { color: color.error },
});
