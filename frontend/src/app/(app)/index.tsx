import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeatherHeroCard } from '@/components/weather/weather-hero-card';
import { displayTitle, Fonts, Radius } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWeather } from '@/hooks/use-weather';
import { functionErrorMessage } from '@/lib/function-error';
import { genderFromUser } from '@/lib/gender';
import { matchOutfitFromWardrobe, type OutfitSuggestion, type WardrobeItem } from '@/lib/outfit-match';
import { loadUserSettings } from '@/lib/user-settings';
import { loadWardrobeCache } from '@/lib/wardrobe-cache';
import { supabase } from '@/lib/supabase';
import { userDisplayName } from '@/lib/user-name';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'God morgon';
  if (hour < 18) return 'God eftermiddag';
  return 'God kväll';
}

export default function Home() {
  const { user } = useAuth();
  const colors = useAppTheme();
  const name = userDisplayName(user);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [request, setRequest] = useState('');
  const [requestedLook, setLook] = useState<OutfitSuggestion | null>(null);
  const [styling, setStyling] = useState(false);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);
  const weather = useWeather();

  useFocusEffect(useCallback(() => {
    let active = true;

    const loadAll = async () => {
      try {
        const settings = await loadUserSettings();
        if (!active) return;
        setAiSuggestionsEnabled(settings.aiSuggestionsEnabled);

        if (!settings.cloudSyncEnabled) {
          const cached = await loadWardrobeCache();
          if (!active) return;
          setWardrobeItems(cached as unknown as WardrobeItem[]);
          return;
        }

        if (!user) return;
        const query = await supabase
          .from('clothing_items')
          .select('id, name, brand, category, color, pattern, material, style, season, favorite, image_path')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        const { data } = query.error
          ? await supabase
            .from('clothing_items')
            .select('id, name, brand, category, color, image_path')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          : query;
        if (!data || !active) return;
        const result = await Promise.all(data.map(async (item) => {
          const signed = item.image_path
            ? await supabase.storage.from('wardrobe-images').createSignedUrl(item.image_path, 3600)
            : null;
          return { ...item, image: signed?.data?.signedUrl ?? null } as unknown as WardrobeItem;
        }));
        if (active) setWardrobeItems(result);
      } catch {
        // Best-effort: if settings fail, fall back to the current behavior (Supabase).
      }
    };

    void loadAll();
    return () => { active = false; };
  }, [user]));

  // Until the user asks for something, show a weather-based look from their own wardrobe.
  const dailyLook = useMemo(() => (
    wardrobeItems.length >= 2 && weather
      ? matchOutfitFromWardrobe(wardrobeItems, 'dagens look', weather, genderFromUser(user))
      : null
  ), [wardrobeItems, weather, user]);
  const look = requestedLook ?? dailyLook;

  const previewItems = useMemo(() => {
    const favorites = wardrobeItems.filter((item) => 'favorite' in item && Boolean((item as WardrobeItem & { favorite?: boolean }).favorite));
    return (favorites.length ? favorites : wardrobeItems).slice(0, 8);
  }, [wardrobeItems]);

  const createSuggestion = async () => {
    const wish = request.trim();
    if (!wish) {
      Alert.alert('Skriv ett önskemål', 'Till exempel “dejt i kväll” eller “casual fredag”.');
      return;
    }
    if (wardrobeItems.length < 2) {
      Alert.alert('För få plagg', 'Lägg till minst två plagg i garderoben först.');
      return;
    }

    const gender = genderFromUser(user);

    setStyling(true);
    try {
      if (!aiSuggestionsEnabled) {
        const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather, gender);
        if (!fallback) throw new Error('Kunde inte sätta ihop en look från garderoben.');
        setLook(fallback);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('suggest-outfit', {
        headers: sessionData.session?.access_token
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
        body: { wish, weather: weather?.summary ?? null, gender },
      });

      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      const itemIds = data?.suggestion?.itemIds as string[] | undefined;
      const selected = (itemIds ?? [])
        .map((id) => wardrobeItems.find((item) => item.id === id))
        .filter((item): item is WardrobeItem => Boolean(item));

      if (selected.length >= 2) {
        setLook({
          items: selected,
          title: data.suggestion.title ?? wish,
          reason: data.suggestion.reason ?? '',
          matchPercent: Number(data.suggestion.matchPercent ?? 80),
        });
        return;
      }

      const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather, gender);
      if (!fallback) throw new Error('Kunde inte sätta ihop en look från garderoben.');
      setLook(fallback);
    } catch {
      const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather, gender);
      if (fallback) setLook(fallback);
      else Alert.alert('Kunde inte skapa look', 'Försök med ett annat önskemål eller lägg till fler plagg.');
    } finally {
      setStyling(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{greeting()} 👋</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          </View>
          <View style={[styles.weatherWrap, { backgroundColor: colors.card }]}>
            <WeatherHeroCard weather={weather} />
          </View>
        </View>

        <LinearGradient
          colors={colors.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lookCard}>
          <View style={styles.lookTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.lookKicker, { color: colors.heroAccent }]}>Dagens look</Text>
              <Text style={[styles.lookTitle, { color: colors.onHero }]} numberOfLines={2}>
                {styling
                  ? 'Sätter ihop en look…'
                  : look?.title ?? 'Väntar på ditt önskemål'}
              </Text>
            </View>
            {look && !styling ? (
              <View style={[styles.match, { backgroundColor: colors.heroOverlay }]}>
                <Ionicons name="sparkles" size={11} color={colors.heroAccent} />
                <Text style={[styles.matchText, { color: colors.onHero }]}>{look.matchPercent}%</Text>
              </View>
            ) : null}
          </View>

          {/* Once there is a look, the clothes speak for themselves; text is only a hint before that. */}
          {!look || styling ? (
            <Text style={[styles.lookReason, { color: colors.onHeroMuted }]} numberOfLines={2}>
              {styling
                ? 'Hämtar plagg från din garderob…'
                : weather
                  ? `Skriv vad du ska göra så anpassas looken till ${weather.summary}.`
                  : 'Skriv vad du ska göra så sätts en look ihop från garderoben.'}
            </Text>
          ) : null}

          {(look?.items?.length || previewItems.length > 0) ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.lookImages}>
              {(look?.items ?? previewItems.slice(0, 4)).map((item) => (
                item.image
                  ? (
                    <View key={item.id} style={styles.lookImageFrame}>
                      <Image
                        source={{ uri: item.image }}
                        style={[styles.lookImage, { backgroundColor: colors.garmentTile }]}
                      />
                    </View>
                  )
                  : (
                    <View key={item.id} style={styles.lookImageFrame}>
                      <View style={[styles.lookImage, { backgroundColor: colors.garmentTile }]} />
                    </View>
                  )
              ))}
            </ScrollView>
          ) : null}

          <View style={[styles.stylistDivider, { backgroundColor: colors.heroOverlay }]} />
          <Text style={[styles.stylistPrompt, { color: colors.onHero }]}>
            Vad ska du ha på dig?
          </Text>
          <View style={[styles.stylistInput, { backgroundColor: colors.heroOverlay }]}>
            <TextInput
              value={request}
              onChangeText={setRequest}
              placeholder="Dejt, jobb, vardag..."
              placeholderTextColor={colors.onHeroMuted}
              style={[styles.stylistField, { color: colors.onHero }]}
              onSubmitEditing={createSuggestion}
              returnKeyType="done"
            />
            <Pressable
              onPress={createSuggestion}
              style={({ pressed }) => [styles.send, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
              <Ionicons
                name={styling ? 'hourglass-outline' : 'arrow-forward'}
                size={18}
                color={colors.accentText}
              />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {previewItems.some((item) => 'favorite' in item && Boolean((item as { favorite?: boolean }).favorite))
              ? 'Favoriter'
              : 'I garderoben'}
          </Text>
          <Pressable
            onPress={() => router.push('/wardrobe')}
            style={[styles.seeAllPill, { backgroundColor: colors.card }]}>
            <Text style={[styles.seeAll, { color: colors.text }]}>Se alla</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.text} />
          </Pressable>
        </View>
        {previewItems.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Inga plagg ännu. Lägg till något med plusknappen.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {previewItems.map((item) => (
              <Pressable key={item.id} onPress={() => router.push('/wardrobe')} style={styles.railItem}>
                <View style={[styles.railImageWrap, { backgroundColor: colors.garmentTile }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.railImage} />
                  ) : (
                    <View style={[styles.railPlaceholder, { backgroundColor: colors.input }]}>
                      <Ionicons name="shirt-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.railName, { color: colors.text }]}>{item.name}</Text>
                <Text numberOfLines={1} style={[styles.railMeta, { color: colors.textMuted }]}>
                  {item.color || item.brand || item.category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 130 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 24,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  title: {
    ...displayTitle,
    marginTop: 6,
  },
  weatherWrap: {
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lookCard: {
    borderRadius: Radius.xl,
    padding: 22,
    marginBottom: 32,
    overflow: 'hidden',
  },
  lookTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  lookKicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  lookTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  lookReason: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  lookImages: { gap: 10, paddingTop: 20 },
  lookImageFrame: {
    width: 112,
  },
  lookImage: {
    width: 112,
    height: 150,
    borderRadius: Radius.lg,
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stylistDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 22,
    marginBottom: 16,
  },
  stylistPrompt: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  stylistInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingLeft: 18,
    paddingRight: 6,
    height: 54,
  },
  stylistField: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
  },
  rail: { gap: 12 },
  railItem: { width: 136 },
  railImageWrap: {
    aspectRatio: 3 / 4,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  railImage: { width: '100%', height: '100%' },
  railPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: -0.1,
  },
  railMeta: {
    fontSize: 11,
    marginTop: 3,
    textTransform: 'capitalize',
  },
});
