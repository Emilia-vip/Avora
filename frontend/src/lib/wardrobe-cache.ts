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
  // Only used in wardrobe UI; home/outfits ignore it.
  favorite?: boolean;
};

/**
 * The wardrobe is cached as a JSON file with each photo downloaded next to it, so offline mode
 * (Cloud Sync off) still shows images after the one-hour signed URLs have expired.
 */
const LEGACY_KEY = 'avora.wardrobeCache.v1';

function cacheFile() {
  return new File(Paths.document, 'wardrobe-cache.json');
}

function imageDirectory() {
  const directory = new Directory(Paths.document, 'wardrobe-images');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

export async function loadWardrobeCache(): Promise<CachedWardrobeItem[]> {
  try {
    const file = cacheFile();
    if (file.exists) {
      const parsed = JSON.parse(await file.text());
      return Array.isArray(parsed) ? parsed : [];
    }

    // One-time move from the old SecureStore cache, which is too small for a whole wardrobe.
    const legacy = await SecureStore.getItemAsync(LEGACY_KEY);
    if (!legacy) return [];
    const parsed = JSON.parse(legacy);
    await SecureStore.deleteItemAsync(LEGACY_KEY);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWardrobeCache(items: CachedWardrobeItem[]): Promise<void> {
  try {
    const withLocalImages = await Promise.all(items.map(storeImageLocally));
    cacheFile().write(JSON.stringify(withLocalImages));
  } catch {
    // Cache is best-effort only.
  }
}

async function storeImageLocally(item: CachedWardrobeItem): Promise<CachedWardrobeItem> {
  if (!item.image || !item.image_path || !/^https?:/.test(item.image)) return item;

  try {
    const local = new File(imageDirectory(), item.image_path.replace(/[^\w.-]/g, '_'));
    if (!local.exists) await File.downloadFileAsync(item.image, local);
    return { ...item, image: local.uri };
  } catch {
    return item;
  }
}
