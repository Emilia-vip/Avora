import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { DEFAULT_USER_SETTINGS, loadUserSettings, type UserSettings } from '@/lib/user-settings';
import { loadWardrobeCache, saveWardrobeCache, type CachedWardrobeItem } from '@/lib/wardrobe-cache';
import { signedImageUrls } from '@/lib/wardrobe-storage';

export type WardrobeItem = CachedWardrobeItem & { favorite: boolean };

const COLUMNS = 'id, name, brand, category, color, pattern, material, style, season, favorite, image_path';

function withFavorite(item: CachedWardrobeItem): WardrobeItem {
  return { ...item, favorite: Boolean(item.favorite) };
}

/**
 * The signed-in user's wardrobe, reloaded every time the screen comes into focus.
 * With Cloud Sync off (or when the network fails) it comes from the on-device cache instead.
 */
export function useWardrobe() {
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setError(null);
        const nextSettings = await loadUserSettings().catch(() => DEFAULT_USER_SETTINGS);
        if (!active) return;
        setSettings(nextSettings);

        if (!user) {
          setItems([]);
          setLoading(false);
          return;
        }

        const showCache = async (message: string | null) => {
          const cached = (await loadWardrobeCache(user.id)).map(withFavorite);
          if (!active) return;
          setItems(cached);
          setError(cached.length ? message : message ?? 'Cloud Sync is paused and there is no offline copy on this device.');
          setLoading(false);
        };

        if (!nextSettings.cloudSyncEnabled) {
          await showCache(null);
          return;
        }

        try {
          const { data, error: queryError } = await supabase
            .from('clothing_items')
            .select(COLUMNS)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (queryError) throw queryError;

          const urls = await signedImageUrls(data.map((item) => item.image_path));
          const result = data.map((item) => withFavorite({
            ...item,
            image: item.image_path ? urls.get(item.image_path) ?? null : null,
          }));
          if (!active) return;

          setItems(result);
          setLoading(false);
          void saveWardrobeCache(user.id, result);
        } catch (loadError) {
          await showCache(loadError instanceof Error ? loadError.message : 'Could not load your wardrobe.');
        }
      };

      void load();
      return () => {
        active = false;
      };
    }, [user]),
  );

  /** Replaces the list (e.g. after a favourite or delete) and keeps the offline cache in step. */
  const updateItems = useCallback((next: WardrobeItem[]) => {
    setItems(next);
    if (user) void saveWardrobeCache(user.id, next);
  }, [user]);

  return { items, updateItems, loading, error, settings, setSettings };
}
