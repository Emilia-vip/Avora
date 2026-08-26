import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { functionErrorMessage } from '@/lib/function-error';
import { matchOutfitFromWardrobe, type OutfitSuggestion, type WardrobeItem } from '@/lib/outfit-match';
import { supabase } from '@/lib/supabase';

function capitalizeName(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Home() {
  const { user } = useAuth();
  const colors = useAppTheme();
  const name = user?.email
    ? capitalizeName(user.email.split('@')[0])
    : 'There';
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [request, setRequest] = useState('');
  const [look, setLook] = useState<OutfitSuggestion | null>(null);
  const [styling, setStyling] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadItems = async () => {
      if (!user) return;
      const query = await supabase
        .from('clothing_items')
        .select('id, name, brand, category, color, pattern, material, style, season, image_path')
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
        const signed = item.image_path ? await supabase.storage.from('wardrobe-images').createSignedUrl(item.image_path, 3600) : null;
        return { ...item, image: signed?.data?.signedUrl ?? null } as WardrobeItem;
      }));
      if (active) setWardrobeItems(result);
    };
    loadItems();
    return () => { active = false; };
  }, [user]));

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
        body: { wish },
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

      const fallback = matchOutfitFromWardrobe(wardrobeItems, wish);
      if (!fallback) throw new Error('Kunde inte sätta ihop en look från garderoben.');
      setLook(fallback);
    } catch {
      const fallback = matchOutfitFromWardrobe(wardrobeItems, wish);
      if (fallback) setLook(fallback);
      else Alert.alert('Kunde inte skapa look', 'Försök med ett annat önskemål eller lägg till fler plagg.');
    } finally {
      setStyling(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>GOOD MORNING</Text>
            <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
          </View>
          <Pressable style={[styles.iconButton, { backgroundColor: colors.card }]}>
            <Ionicons name="notifications-outline" size={19} color={colors.text} />
            <View style={[styles.notificationDot, { backgroundColor: colors.accent }]} />
          </Pressable>
        </View>

        {/* Väder-widget: dagens väder, temperatur och en liten ikon. */}

        <View style={[styles.outfitCard, { backgroundColor: colors.primary }]}>
          <View style={styles.outfitHeader}>
            <View style={styles.sparkle}><Ionicons name="sparkles" size={13} color={colors.accent} /></View>
            <Text style={[styles.outfitLabel, { color: colors.accent }]}>TODAY'S OUTFIT</Text>
          </View>
          <Text style={styles.outfitTitle}>{look?.title ?? 'Dagens look'}</Text>
          <View style={styles.outfitMeta}>
            <Ionicons name="sunny-outline" size={13} color="rgba(255,255,255,0.65)" />
            <Text style={[styles.outfitMetaText, { flex: 1 }]} numberOfLines={3}>{look?.reason ?? 'Skriv ett önskemål nedan så sätter AI ihop plagg som passar.'}</Text>
          </View>
          <View style={styles.outfitImages}>
            {(look?.items ?? wardrobeItems.slice(0, 4)).map((item) => (
              item.image ? <Image key={item.id} source={{ uri: item.image }} style={styles.outfitImage} /> : null
            ))}
          </View>
          <View style={styles.match}>
            <Text style={styles.matchText}>{look ? `${look.matchPercent}% match` : '—'}</Text>
            <Ionicons name="star" size={11} color={colors.accent} />
          </View>
        </View>

        <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aiHeading}><View style={[styles.aiIcon, { backgroundColor: colors.accent }]}><Ionicons name="sparkles" size={15} color={colors.accentText} /></View><View><Text style={[styles.aiTitle, { color: colors.text }]}>Mini AI Stylist</Text><Text style={[styles.aiSubtitle, { color: colors.textMuted }]}>Skriv ett önskemål så plockas plagg som passar ihop</Text></View></View>
          <View style={[styles.aiInputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}><TextInput value={request} onChangeText={setRequest} placeholder="Dejt i kväll, casual fredag, jobbintervju..." placeholderTextColor={colors.textMuted} style={[styles.aiInput, { color: colors.text }]} onSubmitEditing={createSuggestion} returnKeyType="done" /><Pressable onPress={createSuggestion} style={[styles.send, { backgroundColor: colors.primary }]}><Ionicons name="arrow-forward" size={16} color={colors.onPrimary} /></Pressable></View>
          {styling ? <Text style={[styles.aiResultText, { color: colors.textMuted }]}>Sätter ihop en look från din garderob...</Text> : look ? <View><Text style={[styles.aiResultText, { color: colors.text }]}>{look.reason}</Text><Text style={[styles.aiItemNames, { color: colors.textMuted }]}>{look.items.map((item) => item.name).join(' · ')}</Text><View style={styles.suggestionImages}>{look.items.map((item) => item.image ? <Image key={item.id} source={{ uri: item.image }} style={styles.suggestionImage} /> : <View key={item.id} style={[styles.suggestionImage, { backgroundColor: colors.input }]} />)}</View></View> : null}
        </View>

        <View style={styles.stats}>
          {[['12', 'Items', 'pieces'], ['24', 'Outfits', 'saved'], ['68%', 'Worn', 'this month']].map(([value, label, unit]) => (
            <View key={label} style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[styles.statUnit, { color: colors.textMuted }]}>{unit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Favorites</Text>
          <Text style={[styles.seeAll, { color: colors.textMuted }]}>See all</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favorites}>
          {wardrobeItems.map((item) => (
            <View key={item.id} style={styles.favoriteItem}>
              <View style={styles.favoriteImageWrap}>
                {item.image ? <Image source={{ uri: item.image }} style={styles.favoriteImage} /> : null}
                <View style={styles.heart}><Ionicons name="heart" size={11} color={colors.text} /></View>
              </View>
              <Text numberOfLines={1} style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
              <Text numberOfLines={1} style={[styles.itemBrand, { color: colors.textMuted }]}>{item.brand}</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5 },
  title: { fontSize: 27, fontWeight: '500', marginTop: 3 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notificationDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 9, right: 10 },
  outfitCard: { borderRadius: 24, padding: Spacing.lg, minHeight: 230, marginBottom: Spacing.lg },
  outfitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  outfitLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  outfitTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '500', marginTop: 18 },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  outfitMetaText: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  outfitSeparator: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  outfitImages: { flexDirection: 'row', gap: 8, marginTop: 18 },
  outfitImage: { width: 55, height: 55, borderRadius: 12, opacity: 0.9 },
  match: { position: 'absolute', right: Spacing.lg, bottom: Spacing.lg, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 13 },
  statValue: { fontSize: 20, fontWeight: '600' },
  statLabel: { fontSize: 11, marginTop: 3 },
  statUnit: { fontSize: 9, opacity: 0.65, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '500' },
  seeAll: { fontSize: 11 },
  favorites: { gap: 12 },
  favoriteItem: { width: 130 },
  favoriteImageWrap: { aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  favoriteImage: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 9, right: 9, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  itemBrand: { fontSize: 10, marginTop: 2 },
  aiCard: { borderRadius: 22, borderWidth: 1, padding: 16, marginBottom: 24 },
  aiHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  aiIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  aiTitle: { fontSize: 14, fontWeight: '600' },
  aiSubtitle: { fontSize: 10, marginTop: 2 },
  aiInputWrap: { height: 46, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 13, paddingRight: 5 },
  aiInput: { flex: 1, fontSize: 12 },
  send: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aiResultText: { fontSize: 11, marginTop: 14, lineHeight: 16 },
  aiItemNames: { fontSize: 10, marginTop: 6 },
  suggestionImages: { flexDirection: 'row', gap: 8, marginTop: 10 },
  suggestionImage: { width: 58, height: 70, borderRadius: 12 },
});
