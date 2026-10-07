import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentImage } from '@/components/garment/garment-image';
import { WeatherHeroCard } from '@/components/weather/weather-hero-card';
import { displayTitle, Fonts, Radius } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWardrobe, type WardrobeItem } from '@/hooks/use-wardrobe';
import { useWeather } from '@/hooks/use-weather';
import { functionErrorMessage } from '@/lib/function-error';
import { genderFromUser } from '@/lib/gender';
import { matchOutfitFromWardrobe, type OutfitSuggestion } from '@/lib/outfit-match';
import { supabase } from '@/lib/supabase';
import { userDisplayName } from '@/lib/user-name';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { user } = useAuth();
  const colors = useAppTheme();
  const name = userDisplayName(user);
  const { items: wardrobeItems, settings } = useWardrobe();
  const [request, setRequest] = useState('');
  const [requestedLook, setLook] = useState<OutfitSuggestion | null>(null);
  const [styling, setStyling] = useState(false);
  const weather = useWeather();

  // Until the user asks for something, show a weather-based look from their own wardrobe.
  const dailyLook = useMemo(() => (
    wardrobeItems.length >= 2 && weather
      ? matchOutfitFromWardrobe(wardrobeItems, "today's look", weather, genderFromUser(user))
      : null
  ), [wardrobeItems, weather, user]);
  const look = requestedLook ?? dailyLook;

  const previewItems = useMemo(() => {
    const favorites = wardrobeItems.filter((item) => item.favorite);
    return (favorites.length ? favorites : wardrobeItems).slice(0, 8);
  }, [wardrobeItems]);

  const createSuggestion = async () => {
    const wish = request.trim();
    if (styling) return;
    if (!wish) {
      Alert.alert('Tell the stylist what you need', 'For example “date night” or “casual Friday”.');
      return;
    }
    if (wardrobeItems.length < 2) {
      Alert.alert('Not enough clothes', 'Add at least two garments to your wardrobe first.');
      return;
    }

    const gender = genderFromUser(user);

    setStyling(true);
    try {
      if (!settings.aiSuggestionsEnabled) {
        const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather, gender);
        if (!fallback) throw new Error('Could not put together a look from your wardrobe.');
        setLook(fallback);
        return;
      }

      const { data, error } = await supabase.functions.invoke('suggest-outfit', {
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
      if (!fallback) throw new Error('Could not put together a look from your wardrobe.');
      setLook(fallback);
    } catch (error) {
      // Still show a look built on the phone, but say why the AI stylist didn't answer (e.g. daily quota used up).
      const fallback = matchOutfitFromWardrobe(wardrobeItems, wish, weather, gender);
      const reason = error instanceof Error ? error.message : null;
      if (fallback) {
        setLook(fallback);
        if (reason) Alert.alert('The AI stylist is unavailable', `${reason}\n\nHere is a look picked on your phone instead.`);
      } else {
        Alert.alert('Could not create a look', reason ?? 'Try another request or add more clothes.');
      }
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
              <Text style={[styles.lookKicker, { color: colors.heroAccent }]}>Today’s look</Text>
              <Text style={[styles.lookTitle, { color: colors.onHero }]} numberOfLines={2}>
                {styling
                  ? 'Putting a look together…'
                  : look?.title ?? 'Waiting for your request'}
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
                ? 'Picking pieces from your wardrobe…'
                : weather
                  ? `Tell me what you're up to and the look will suit ${weather.summary}.`
                  : "Tell me what you're up to and I'll build a look from your wardrobe."}
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
                      <GarmentImage
                      uri={item.image}
                      path={item.image_path}
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
            What are you dressing for?
          </Text>
          <View style={[styles.stylistInput, { backgroundColor: colors.heroOverlay }]}>
            <TextInput
              value={request}
              onChangeText={setRequest}
              placeholder="Date, work, everyday…"
              placeholderTextColor={colors.onHeroMuted}
              style={[styles.stylistField, { color: colors.onHero }]}
              onSubmitEditing={createSuggestion}
              returnKeyType="done"
            />
            <Pressable
              onPress={createSuggestion}
              disabled={styling}
              accessibilityRole="button"
              accessibilityLabel="Get a look"
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: colors.accent, opacity: styling ? 0.6 : pressed ? 0.85 : 1 },
              ]}>
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
            {previewItems.some((item) => item.favorite)
              ? 'Favourites'
              : 'In your wardrobe'}
          </Text>
          <Pressable
            onPress={() => router.push('/wardrobe')}
            style={[styles.seeAllPill, { backgroundColor: colors.card }]}>
            <Text style={[styles.seeAll, { color: colors.text }]}>See all</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.text} />
          </Pressable>
        </View>
        {previewItems.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            No clothes yet. Add something with the plus button.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {previewItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                style={styles.railItem}>
                <View style={[styles.railImageWrap, { backgroundColor: colors.garmentTile }]}>
                  {item.image ? (
                    <GarmentImage
                      uri={item.image}
                      path={item.image_path}
                      style={styles.railImage}
                    />
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
