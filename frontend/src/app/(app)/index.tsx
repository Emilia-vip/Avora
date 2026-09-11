import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeatherHeroCard } from '@/components/weather/weather-hero-card';
import { Radius, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWeather } from '@/hooks/use-weather';
import { functionErrorMessage } from '@/lib/function-error';
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
  const [look, setLook] = useState<OutfitSuggestion | null>(null);
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
          return { ...item, image: signed?.data?.signedUrl ?? null } as WardrobeItem;
        }));
        if (active) setWardrobeItems(result);
      } catch {
        // Best-effort: if settings fail, fall back to the current behavior (Supabase).
      }
    };

    void loadAll();
    return () => { active = false; };
  }, [user]));

  useEffect(() => {
    if (look || wardrobeItems.length < 2 || !weather) return;
    setLook(matchOutfitFromWardrobe(wardrobeItems, 'dagens look', weather));
  }, [look, wardrobeItems, weather]);

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

    setStyling(true);
    try {
      if (!aiSuggestionsEnabled) {
        const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather);
        if (!fallback) throw new Error('Kunde inte sätta ihop en look från garderoben.');
        setLook(fallback);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('suggest-outfit', {
        headers: sessionData.session?.access_token
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
        body: { wish, weather: weather?.summary ?? null },
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

      const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather);
      if (!fallback) throw new Error('Kunde inte sätta ihop en look från garderoben.');
      setLook(fallback);
    } catch {
      const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather);
      if (fallback) setLook(fallback);
      else Alert.alert('Kunde inte skapa look', 'Försök med ett annat önskemål eller lägg till fler plagg.');
    } finally {
      setStyling(false);
    }
  };

  const softCard = {
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    ...Shadows.card,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>{greeting()}</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          </View>
          <View style={[styles.weatherWrap, softCard]}>
            <WeatherHeroCard weather={weather} />
          </View>
        </View>

        <View style={[styles.lookCard, { backgroundColor: colors.primary }]}>
          <View style={styles.lookTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.lookKicker, { color: colors.accent }]}>Dagens look</Text>
              <Text style={[styles.lookTitle, { color: colors.onPrimary }]}>
                {styling
                  ? 'Sätter ihop en look…'
                  : look?.title ?? 'Väntar på ditt önskemål'}
              </Text>
            </View>
            {look && !styling ? (
              <View style={[styles.match, { backgroundColor: 'rgba(255,249,248,0.14)' }]}>
                <Text style={[styles.matchText, { color: colors.onPrimary }]}>{look.matchPercent}%</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.lookReason, { color: 'rgba(255,249,248,0.62)' }]} numberOfLines={3}>
            {styling
              ? 'Hämtar plagg från din garderob…'
              : look?.reason ?? (weather
                ? `Skriv vad du ska göra så anpassas looken till ${weather.summary}.`
                : 'Skriv vad du ska göra så sätts en look ihop från garderoben.')}
          </Text>

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
                        style={[styles.lookImage, { backgroundColor: 'rgba(255,249,248,0.1)' }]}
                      />
                      {look ? (
                        <Text numberOfLines={1} style={styles.lookImageName}>{item.name}</Text>
                      ) : null}
                    </View>
                  )
                  : (
                    <View key={item.id} style={styles.lookImageFrame}>
                      <View style={[styles.lookImage, { backgroundColor: 'rgba(255,249,248,0.1)' }]} />
                      {look ? (
                        <Text numberOfLines={1} style={styles.lookImageName}>{item.name}</Text>
                      ) : null}
                    </View>
                  )
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.stylistDivider} />
          <Text style={[styles.stylistPrompt, { color: 'rgba(255,249,248,0.5)' }]}>
            Vad ska du ha på dig?
          </Text>
          <View style={styles.stylistInput}>
            <TextInput
              value={request}
              onChangeText={setRequest}
              placeholder="Dejt, jobb, vardag..."
              placeholderTextColor="rgba(255,249,248,0.4)"
              style={[styles.stylistField, { color: colors.onPrimary }]}
              onSubmitEditing={createSuggestion}
              returnKeyType="done"
            />
            <Pressable
              onPress={createSuggestion}
              style={[styles.send, { backgroundColor: colors.accent }]}>
              <Ionicons
                name={styling ? 'hourglass-outline' : 'arrow-forward'}
                size={18}
                color={colors.accentText}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {previewItems.some((item) => 'favorite' in item && Boolean((item as { favorite?: boolean }).favorite))
              ? 'Favoriter'
              : 'I garderoben'}
          </Text>
          <Pressable onPress={() => router.push('/wardrobe')}>
            <Text style={[styles.seeAll, { color: colors.accent }]}>Se alla</Text>
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
                <View style={[styles.railImageWrap, softCard]}>
                  {item.image ? <Image source={{ uri: item.image }} style={styles.railImage} /> : null}
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
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 120 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 22,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: -0.6,
  },
  weatherWrap: {
    borderRadius: Radius.lg,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  lookCard: {
    borderRadius: Radius.xl,
    padding: 22,
    marginBottom: 28,
  },
  lookTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  lookKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  lookTitle: {
    fontSize: 22,
    fontWeight: '500',
    marginTop: 6,
    letterSpacing: -0.4,
  },
  lookReason: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  lookImages: { gap: 10, paddingTop: 18 },
  lookImageFrame: {
    width: 96,
  },
  lookImage: {
    width: 96,
    height: 128,
    borderRadius: 16,
  },
  lookImageName: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,249,248,0.75)',
  },
  match: {
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  stylistDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,249,248,0.16)',
    marginTop: 20,
    marginBottom: 16,
  },
  stylistPrompt: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  stylistInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,248,0.12)',
    borderRadius: 18,
    paddingLeft: 16,
    paddingRight: 6,
    height: 52,
  },
  stylistField: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
  },
  rail: { gap: 14 },
  railItem: { width: 122 },
  railImageWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 18,
    overflow: 'hidden',
  },
  railImage: { width: '100%', height: '100%' },
  railName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: -0.1,
  },
  railMeta: {
    fontSize: 11,
    marginTop: 3,
  },
});
