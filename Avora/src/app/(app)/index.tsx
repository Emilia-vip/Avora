import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeatherHeroCard } from '@/components/weather/weather-hero-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWeather } from '@/hooks/use-weather';
import { functionErrorMessage } from '@/lib/function-error';
import { matchOutfitFromWardrobe, type OutfitSuggestion, type WardrobeItem } from '@/lib/outfit-match';
import { supabase } from '@/lib/supabase';

function capitalizeName(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'God morgon';
  if (hour < 18) return 'God eftermiddag';
  return 'God kväll';
}

export default function Home() {
  const { user } = useAuth();
  const colors = useAppTheme();
  const name = user?.email ? capitalizeName(user.email.split('@')[0]) : 'där';
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [request, setRequest] = useState('');
  const [look, setLook] = useState<OutfitSuggestion | null>(null);
  const [styling, setStyling] = useState(false);
  const weather = useWeather();

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadItems = async () => {
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
    };
    loadItems();
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.greetingCard, { backgroundColor: colors.card }]}>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>{greeting()}</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          </View>
          <WeatherHeroCard weather={weather} />
        </View>

        <View style={[styles.lookCard, { backgroundColor: colors.card }]}>
          <View style={styles.lookTop}>
            <View>
              <Text style={[styles.lookKicker, { color: colors.accent }]}>Dagens look</Text>
              <Text style={[styles.lookTitle, { color: colors.text }]}>{look?.title ?? 'Väntar på garderoben'}</Text>
            </View>
            {look ? (
              <View style={[styles.match, { backgroundColor: colors.input }]}>
                <Text style={[styles.matchText, { color: colors.text }]}>{look.matchPercent}%</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.lookReason, { color: colors.textMuted }]} numberOfLines={3}>
            {look?.reason ?? (weather ? `Anpassas till ${weather.summary}.` : 'Lägg till plagg så sätts en look ihop efter vädret.')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lookImages}>
            {(look?.items ?? previewItems.slice(0, 4)).map((item) => (
              item.image
                ? <Image key={item.id} source={{ uri: item.image }} style={styles.lookImage} />
                : <View key={item.id} style={[styles.lookImage, { backgroundColor: colors.input }]} />
            ))}
          </ScrollView>
        </View>

        <View style={[styles.stylist, { backgroundColor: colors.primary }]}>
          <Text style={styles.stylistKicker}>Stylist</Text>
          <Text style={styles.stylistTitle}>Vad ska du ha på dig?</Text>
          <View style={styles.stylistInput}>
            <TextInput
              value={request}
              onChangeText={setRequest}
              placeholder="Dejt, jobb, vardag..."
              placeholderTextColor="rgba(255,252,248,0.45)"
              style={styles.stylistField}
              onSubmitEditing={createSuggestion}
              returnKeyType="done"
            />
            <Pressable onPress={createSuggestion} style={[styles.send, { backgroundColor: colors.accent }]}>
              <Ionicons name={styling ? 'hourglass-outline' : 'arrow-forward'} size={18} color={colors.accentText} />
            </Pressable>
          </View>
          {styling ? (
            <Text style={styles.stylistStatus}>Sätter ihop en look…</Text>
          ) : look ? (
            <Text style={styles.stylistStatus} numberOfLines={2}>{look.items.map((item) => item.name).join('  ·  ')}</Text>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {previewItems.some((item) => 'favorite' in item && Boolean((item as { favorite?: boolean }).favorite)) ? 'Favoriter' : 'I garderoben'}
          </Text>
          <Pressable onPress={() => router.push('/wardrobe')}>
            <Text style={[styles.seeAll, { color: colors.textMuted }]}>Alla</Text>
          </Pressable>
        </View>
        {previewItems.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>Inga plagg ännu. Lägg till något med plusknappen.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {previewItems.map((item) => (
              <Pressable key={item.id} onPress={() => router.push('/wardrobe')} style={styles.railItem}>
                <View style={[styles.railImageWrap, { backgroundColor: colors.card }]}>
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
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 120 },
  greetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
    shadowColor: '#2A221C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  title: { fontSize: 26, fontWeight: '500', marginTop: 2, letterSpacing: -0.5 },
  lookCard: {
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#2A221C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  lookTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  lookKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  lookTitle: { fontSize: 22, fontWeight: '500', marginTop: 4, letterSpacing: -0.3 },
  lookReason: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  lookImages: { gap: 10, paddingTop: 16 },
  lookImage: { width: 92, height: 124, borderRadius: 16 },
  match: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  matchText: { fontSize: 12, fontWeight: '700' },
  stylist: { borderRadius: 28, padding: 20, marginBottom: 28 },
  stylistKicker: { color: 'rgba(255,252,248,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  stylistTitle: { color: '#FFFCF8', fontSize: 24, fontWeight: '500', marginTop: 6, letterSpacing: -0.4 },
  stylistInput: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,252,248,0.1)',
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 6,
    height: 52,
  },
  stylistField: { flex: 1, color: '#FFFCF8', fontSize: 15, paddingVertical: 12 },
  send: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stylistStatus: { color: 'rgba(255,252,248,0.62)', fontSize: 12, marginTop: 12, lineHeight: 17 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '500' },
  seeAll: { fontSize: 13 },
  empty: { fontSize: 13, lineHeight: 20 },
  rail: { gap: 12 },
  railItem: { width: 118 },
  railImageWrap: { aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden' },
  railImage: { width: '100%', height: '100%' },
  railName: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  railMeta: { fontSize: 11, marginTop: 2 },
});
