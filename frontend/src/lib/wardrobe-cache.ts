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
  // Only used in wardrobe UI; home/outfits ignore it.
  favorite?: boolean;
};

const KEY = 'avora.wardrobeCache.v1';

export async function loadWardrobeCache(): Promise<CachedWardrobeItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedWardrobeItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveWardrobeCache(items: CachedWardrobeItem[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(items));
  } catch {
    // Cache is best-effort only.
  }
}

