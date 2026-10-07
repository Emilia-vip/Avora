import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

export type CachedWardrobeItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  color: string | null;
  pattern: string | null;
  material: string | null;
  style: string | null;
  season?: string | null;
  image: string | null;
  image_path?: string | null;
  favorite?: boolean;
};

/**
 * Each user's wardrobe is cached in its own folder (JSON plus downloaded photos), so offline mode
 * (Cloud Sync off) still shows images after the one-hour signed URLs have expired, and one account
 * never sees another account's clothes on a shared phone. The folder is deleted on logout.
 */
function userDirectory(userId: string) {
  return new Directory(Paths.document, 'wardrobe-cache', userId.replace(/[^\w-]/g, '_'));
}

function cacheFile(userId: string) {
  return new File(userDirectory(userId), 'wardrobe.json');
}

/** Older versions kept one shared cache for every account; nobody can tell whose it was, so it is dropped. */
async function removeLegacyCache() {
  try {
    const file = new File(Paths.document, 'wardrobe-cache.json');
    if (file.exists) file.delete();
    const images = new Directory(Paths.document, 'wardrobe-images');
    if (images.exists) images.delete();
    await SecureStore.deleteItemAsync('avora.wardrobeCache.v1');
  } catch {
    // Best-effort.
  }
}

export async function loadWardrobeCache(userId: string): Promise<CachedWardrobeItem[]> {
  await removeLegacyCache();
  try {
    const file = cacheFile(userId);
    if (!file.exists) return [];
    const parsed = JSON.parse(await file.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWardrobeCache(userId: string, items: CachedWardrobeItem[]): Promise<void> {
  try {
    const directory = userDirectory(userId);
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
    const withLocalImages = await Promise.all(items.map((item) => storeImageLocally(directory, item)));
    cacheFile(userId).write(JSON.stringify(withLocalImages));
  } catch {
    // Cache is best-effort only.
  }
}

export function clearWardrobeCache(userId: string) {
  try {
    const directory = userDirectory(userId);
    if (directory.exists) directory.delete();
  } catch {
    // Best-effort.
  }
}

async function storeImageLocally(directory: Directory, item: CachedWardrobeItem): Promise<CachedWardrobeItem> {
  if (!item.image || !item.image_path || !/^https?:/.test(item.image)) return item;

  try {
    const local = new File(directory, item.image_path.replace(/[^\w.-]/g, '_'));
    if (!local.exists) await File.downloadFileAsync(item.image, local);
    return { ...item, image: local.uri };
  } catch {
    return item;
  }
}
