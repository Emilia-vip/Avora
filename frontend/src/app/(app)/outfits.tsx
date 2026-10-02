import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cardSurface, displayTitle, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { genderFromUser } from '@/lib/gender';
import { matchOutfitFromWardrobe, type OutfitSuggestion, type WardrobeItem } from '@/lib/outfit-match';
import { loadUserSettings } from '@/lib/user-settings';
import { loadWardrobeCache, saveWardrobeCache } from '@/lib/wardrobe-cache';
import { supabase } from '@/lib/supabase';
import { useWeather } from '@/hooks/use-weather';

const wishes = ['vardag', 'jobbintervju', 'dejt i kväll'];

export default function Outfits() {
  const colors = useAppTheme();
  const { user } = useAuth();
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const weather = useWeather();
  const gender = genderFromUser(user);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadItems = async () => {
        const settings = await loadUserSettings();

        if (!settings.cloudSyncEnabled) {
          const cached = await loadWardrobeCache();
          if (!active) return;
          setWardrobeItems(cached as unknown as WardrobeItem[]);
          setLoading(false);
          return;
        }

        if (!user) {
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('clothing_items')
          .select('id, name, brand, category, color, pattern, material, style, season, image_path')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (!data || !active) {
          if (active) setLoading(false);
          return;
        }
        const result = await Promise.all(data.map(async (item) => {
          const signed = item.image_path
            ? await supabase.storage.from('wardrobe-images').createSignedUrl(item.image_path, 3600)
            : null;
          return { ...item, image: signed?.data?.signedUrl ?? null } as WardrobeItem;
        }));
        if (active) {
          setWardrobeItems(result);
          void saveWardrobeCache(result as any);
          setLoading(false);
        }
      };
      loadItems();
      return () => { active = false; };
    }, [user]),
  );

  const looks = useMemo(() => {
    const used = new Set<string>();
    const suggestions: OutfitSuggestion[] = [];
    for (const wish of wishes) {
      const remaining = wardrobeItems.filter((item) => !used.has(item.id));
      const look = matchOutfitFromWardrobe(
        remaining.length >= 2 ? remaining : wardrobeItems,
        wish,
        weather,
        gender,
      );
      if (!look) continue;
      look.items.forEach((item) => used.add(item.id));
      suggestions.push(look);
    }
    return suggestions;
  }, [wardrobeItems, weather, gender]);

  const softCard = cardSurface(colors);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Styling</Text>
            <Text style={[styles.title, { color: colors.text }]}>Looks</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {weather ? `Anpassat till ${weather.summary}` : 'Ihopsatta från din garderob'}
            </Text>
          </View>
          <View style={[styles.iconButton, softCard]}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Förslag</Text>

        {loading ? (
          <Text style={{ color: colors.textMuted }}>Laddar garderoben…</Text>
        ) : null}
        {!loading && looks.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>
            Lägg till minst två plagg för att få outfitförslag.
          </Text>
        ) : null}

        {looks.map((outfit) => (
          <View key={outfit.title} style={[styles.card, softCard]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.outfitName, { color: colors.text }]} numberOfLines={2}>{outfit.title}</Text>
              </View>
              <View style={[styles.match, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="sparkles" size={10} color={colors.accent} />
                <Text style={[styles.matchText, { color: colors.accent }]}>
                  {outfit.matchPercent}%
                </Text>
              </View>
            </View>
            <View style={styles.images}>
              {outfit.items.map((item) => (
                <View key={item.id} style={styles.piece}>
                  {item.image
                    ? <Image source={{ uri: item.image }} style={[styles.image, { backgroundColor: colors.garmentTile }]} />
                    : <View style={[styles.image, { backgroundColor: colors.input }]} />}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: Spacing.md, paddingBottom: 130 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  title: {
    ...displayTitle,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
    maxWidth: 240,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  outfitName: {
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    textTransform: 'capitalize',
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  matchText: {
    fontSize: 11,
    fontWeight: '600',
  },
  images: {
    flexDirection: 'row',
    gap: 8,
  },
  piece: {
    flex: 1,
    minWidth: 0,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.lg,
  },
});
