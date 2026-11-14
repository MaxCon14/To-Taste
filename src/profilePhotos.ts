import { decode } from 'base64-arraybuffer';
import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { saveCook, type Cook, type CookChanges } from './socialApi';
import { requireSupabase } from './supabase';

const bucket = 'cook-profile-images';
export type ProfileImage = { uri: string; base64: string };
type Slot = 'avatar' | 'banner';
type Images = Partial<Record<Slot, ProfileImage | null>>;

export async function pickProfilePhoto(slot: Slot): Promise<ProfileImage | undefined> {
  const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: slot === 'avatar', aspect: [1, 1] });
  if (result.canceled) return;
  const image = result.assets[0];
  const maxSide = slot === 'avatar' ? 480 : 1440;
  const context = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > maxSide) {
    context.resize(image.width >= image.height ? { width: maxSide } : { height: maxSide });
  }
  const rendered = await context.renderAsync();
  const { uri, base64 } = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!base64) throw new Error('Couldn’t prepare this photo. Try a different one.');
  return { uri, base64 };
}

export function profileImageUrl(path?: string | null) {
  if (path) return requireSupabase().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function saveProfilePhotos(owner: string, existing: Cook, changes: CookChanges, images: Images) {
  const storage = requireSupabase().storage.from(bucket);
  const paths: CookChanges = {};
  const uploaded: string[] = [];
  const replaced: string[] = [];
  let saved: Cook;
  try {
    for (const slot of ['avatar', 'banner'] as const) {
      const image = images[slot];
      if (image === undefined) continue;
      const field = slot === 'avatar' ? 'avatar_image' : 'banner_image';
      if (existing[field]) replaced.push(existing[field]);
      if (image === null) {
        paths[field] = null;
        continue;
      }
      const path = `${owner}/${slot}-${randomUUID()}.jpg`;
      const { error } = await storage.upload(path, decode(image.base64), { contentType: 'image/jpeg', cacheControl: '3600' });
      if (error) throw new Error('Couldn’t upload your photo. Try again.');
      uploaded.push(path);
      paths[field] = path;
    }
    saved = await saveCook({ ...changes, ...paths }, true, owner);
  } catch (error) {
    // A response may fail after the write commits. Keep any upload that is already attached.
    if (uploaded.length) {
      const { data } = await requireSupabase().from('cook_profiles').select('avatar_image,banner_image').eq('user_id', owner).maybeSingle();
      const detached = data ? uploaded.filter(path => path !== data.avatar_image && path !== data.banner_image) : [];
      if (detached.length) await storage.remove(detached).catch(() => {});
    }
    throw error;
  }
  if (replaced.length) void storage.remove(replaced).then(() => {}, () => {});
  return saved;
}
