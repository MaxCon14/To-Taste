import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Field, Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { pickProfilePhoto, profileImageUrl, saveProfilePhotos, type ProfileImage } from './profilePhotos';
import { emptyDraft } from './recipes';
import { readCook, saveCook, type Banner, type Cook } from './socialApi';
import { Action, color, Copy, Cover, font } from './ui';

const banners: Record<Banner, string> = { pasta: 'Tomato pasta', chicken: 'Lemon chicken', pancakes: 'Pancakes', chickpeas: 'Chickpeas', salmon: 'Salmon' };
const usernamePattern = /^[a-z0-9][a-z0-9_]{2,23}$/;

function cleanIdentity(name: string, handle: string) {
  const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
  if (!name.trim()) throw new Error('Enter a display name.');
  if (!usernamePattern.test(cleanHandle)) throw new Error('Start your username with a letter or number. Use 3–24 letters, numbers or underscores.');
  return { name: name.trim(), handle: cleanHandle };
}

export function profileUrl(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  const url = new URL(clean);
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password || url.href.length > 300) throw new Error();
  return url.href;
}

export function ProfileAvatar({ name, uri, size = 56 }: { name: string; uri?: string; size?: number }) {
  return <View aria-hidden style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Copy style={styles.initial}>{[...name.trim()][0]?.toUpperCase() ?? '?'}</Copy>
    {!!uri && <Image source={{ uri }} resizeMode="cover" style={styles.image} />}
  </View>;
}

export function ProfileBanner({ banner, uri }: { banner: Banner; uri?: string }) {
  return uri ? <Image source={{ uri }} resizeMode="cover" style={styles.image} /> : <Cover recipe={{ ...emptyDraft, cover: banner }} />;
}

function IdentityFields({ name, handle, setName, setHandle, busy }: {
  name: string; handle: string; setName: (value: string) => void; setHandle: (value: string) => void; busy: boolean;
}) {
  return <>
    <Field label="Display name" value={name} onChangeText={setName} autoComplete="name" maxLength={60} editable={!busy} placeholder="Your name" />
    <Field label="Username" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false}
      placeholder="your_username" maxLength={25} editable={!busy} />
    <Copy style={styles.helper}>3–24 characters. Use letters, numbers or underscores.</Copy>
  </>;
}

export function ProfileIdentity({ userId, initialName, initialHandle, saved }: {
  userId: string; initialName: string; initialHandle?: string; saved: (cook: Cook) => void;
}) {
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState(initialHandle ?? '');
  const { busy, error, run } = useSubmission();
  return <>
    <View style={styles.identityPreview}>
      <ProfileAvatar name={name} size={54} />
      <View style={styles.identityCopy}>
        <Copy style={styles.previewName}>{name.trim() || 'Your name'}</Copy>
        <Copy style={styles.helper}>@{handle.trim().toLowerCase().replace(/^@/, '') || 'username'}</Copy>
      </View>
    </View>
    <IdentityFields {...{ name, handle, setName, setHandle, busy }} />
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
    <Action label={busy ? 'Saving…' : 'Continue'} disabled={busy || !name.trim() || !handle.trim()} onPress={() => void run(async () => {
      const changes = cleanIdentity(name, handle);
      const current = await readCook({ id: userId });
      saved(await saveCook(changes, !!current, userId));
    })} />
  </>;
}

export function ProfileEditor({ userId, close, saved, onboarding = false, onBusy }: {
  userId: string; close?: () => void; saved: (cook: Cook) => void; onboarding?: boolean; onBusy?: (busy: boolean) => void;
}) {
  const [existing, setExisting] = useState<Cook | null>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void readCook({ id: userId }).then(cook => { if (active) setExisting(cook); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [userId, retry]);
  if (existing) return <ProfileForm existing={existing} close={close} saved={saved} onboarding={onboarding} onBusy={onBusy} />;
  const loading = failed || existing === null
    ? <><Copy accessibilityRole="alert" style={styles.error}>Couldn’t open your profile.</Copy>
      <Action secondary label="Try again" onPress={() => setRetry(value => value + 1)} /></>
    : <Copy accessibilityLiveRegion="polite" style={styles.helper}>Opening your profile…</Copy>;
  return onboarding ? loading : <Sheet title="Your public profile" close={close}>{loading}</Sheet>;
}

function ProfileForm({ existing, close, saved, onboarding, onBusy }: {
  existing: Cook; close?: () => void; saved: (cook: Cook) => void; onboarding: boolean; onBusy?: (busy: boolean) => void;
}) {
  const [name, setName] = useState(existing.name);
  const [handle, setHandle] = useState(existing.handle);
  const [bio, setBio] = useState(existing.bio);
  const [banner, setBanner] = useState(existing.banner);
  const [avatarImage, setAvatarImage] = useState<ProfileImage | null>();
  const [bannerImage, setBannerImage] = useState<ProfileImage | null>();
  const [website, setWebsite] = useState(existing.website);
  const [social, setSocial] = useState(existing.social_link);
  const [links, setLinks] = useState(!onboarding || !!website || !!social);
  const { busy, error, run } = useSubmission();
  const avatar = avatarImage === undefined ? profileImageUrl(existing.avatar_image) : avatarImage?.uri;
  const cover = bannerImage === undefined ? profileImageUrl(existing.banner_image) : bannerImage?.uri;

  function submit(action: () => Promise<void>) {
    void run(async () => {
      onBusy?.(true);
      try { await action(); }
      finally { onBusy?.(false); }
    });
  }

  const content = <>
    {!onboarding && <Copy style={styles.helper}>These details appear on your public profile.</Copy>}
    <View style={styles.preview}>
      <View style={styles.banner} aria-hidden><ProfileBanner banner={banner} uri={cover} /></View>
      <View style={styles.previewBody}>
        <View style={styles.avatarRing}><ProfileAvatar name={name} uri={avatar} size={62} /></View>
        <Copy style={styles.previewName}>{name.trim() || 'Your name'}</Copy>
        <Copy style={styles.helper}>@{handle.trim().toLowerCase().replace(/^@/, '')}</Copy>
        {!!bio.trim() && <Copy numberOfLines={3} style={styles.previewBio}>{bio.trim()}</Copy>}
      </View>
    </View>
    {!onboarding && <IdentityFields {...{ name, handle, setName, setHandle, busy }} />}
    <View style={styles.actions}>
      <Action secondary label={avatar ? 'Change photo' : 'Add photo'} disabled={busy} onPress={() => submit(async () => {
        const image = await pickProfilePhoto('avatar');
        if (image) setAvatarImage(image);
      })}><Glyph name="plus" color={color.ink} size={16} /></Action>
      {!!avatar && <Action secondary label="Remove photo" disabled={busy} onPress={() => setAvatarImage(null)} />}
    </View>
    <View style={styles.group}>
      <Copy accessibilityRole="header" style={styles.label}>Banner</Copy>
      <View accessibilityRole="radiogroup" accessibilityLabel="Banner" style={styles.bannerChoices}>
        {(Object.keys(banners) as Banner[]).map(option => {
          const checked = banner === option && !cover;
          return <MotionPressable key={option} accessibilityRole="radio" accessibilityLabel={banners[option]} accessibilityState={{ checked }}
            disabled={busy} onPress={() => { setBanner(option); setBannerImage(null); }}
            style={[styles.bannerChoice, checked && styles.bannerSelected]}>
            <ProfileBanner banner={option} />
            {checked && <View style={styles.bannerBadge}><Glyph name="check" color={color.white} size={12} /></View>}
          </MotionPressable>;
        })}
      </View>
      <Action secondary label={cover ? 'Change banner photo' : 'Upload a banner'} disabled={busy} onPress={() => submit(async () => {
        const image = await pickProfilePhoto('banner');
        if (image) setBannerImage(image);
      })} />
    </View>
    <Field label="Bio · optional" value={bio} onChangeText={setBio} placeholder="I’m usually in the kitchen making…"
      multiline maxLength={280} editable={!busy} style={styles.bioInput} />
    {links ? <>
      <Field label="Website · optional" value={website} onChangeText={setWebsite} placeholder="https://…" keyboardType="url"
        autoCapitalize="none" autoCorrect={false} maxLength={300} editable={!busy} />
      <Field label="Social link · optional" value={social} onChangeText={setSocial} placeholder="https://…" keyboardType="url"
        autoCapitalize="none" autoCorrect={false} maxLength={300} editable={!busy} />
    </> : <Action secondary label="Add links" disabled={busy} onPress={() => setLinks(true)} />}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
    <Action label={busy ? 'One moment…' : onboarding ? 'Continue' : 'Save public profile'} disabled={busy} onPress={() => submit(async () => {
      let validatedLinks;
      try { validatedLinks = { website: profileUrl(website), social_link: profileUrl(social) }; }
      catch { throw new Error('Enter full HTTPS links, or leave those fields blank.'); }
      const identity = onboarding ? {} : cleanIdentity(name, handle);
      saved(await saveProfilePhotos(existing.user_id, existing, {
        ...identity, ...validatedLinks, bio: bio.trim(), banner,
      }, { avatar: avatarImage, banner: bannerImage }));
    })} />
  </>;

  return onboarding ? content : <Sheet title="Your public profile" close={close} busy={busy}>{content}</Sheet>;
}

const styles = StyleSheet.create({
  helper: { color: color.secondaryInk, fontSize: 14, lineHeight: 20 },
  identityPreview: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 23, backgroundColor: color.muted },
  identityCopy: { flex: 1, gap: 2 },
  preview: { overflow: 'hidden', borderRadius: 24, backgroundColor: color.muted },
  banner: { height: 142, overflow: 'hidden', backgroundColor: color.rule },
  previewBody: { paddingHorizontal: 16, paddingBottom: 15, gap: 3, alignItems: 'flex-start' },
  avatar: { backgroundColor: color.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarRing: { marginTop: -34, borderWidth: 4, borderColor: color.muted, borderRadius: 36 },
  initial: { fontFamily: font.bold, color: color.white, fontSize: 22 },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  previewName: { fontFamily: font.bold, fontSize: 22, letterSpacing: -0.55 },
  previewBio: { fontSize: 14, marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { gap: 10 },
  label: { fontFamily: font.bold, fontSize: 15 },
  bannerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  bannerChoice: { flex: 1, minWidth: 46, height: 56, borderRadius: 11, overflow: 'hidden', borderWidth: 2, borderColor: color.rule },
  bannerSelected: { borderColor: color.ink },
  bannerBadge: { position: 'absolute', bottom: 3, right: 3, borderRadius: 9, width: 18, height: 18, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  bioInput: { minHeight: 84, textAlignVertical: 'top' },
  error: { color: color.error },
});
