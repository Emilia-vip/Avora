import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { matchOutfitFromWardrobe, type OutfitSuggestion, type WardrobeItem } from '@/lib/outfit-match';
import { supabase } from '@/lib/supabase';

const wishes = ['vardag', 'jobbintervju', 'dejt i kväll'];

export default function Outfits() {
  const colors = useAppTheme();
  const { user } = useAuth();
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadItems = async () => {
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
      const look = matchOutfitFromWardrobe(remaining.length >= 2 ? remaining : wardrobeItems, wish);
      if (!look) continue;
      look.items.forEach((item) => used.add(item.id));
      suggestions.push(look);
    }
    return suggestions;
  }, [wardrobeItems]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Outfits</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Ihopsatta från din garderob</Text>
          </View>
          <View style={[styles.iconButton, { backgroundColor: colors.card }]}><Ionicons name="sparkles-outline" size={19} color={colors.text} /></View>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Förslag</Text>
        {loading ? <Text style={{ color: colors.textMuted }}>Laddar garderoben...</Text> : null}
        {!loading && looks.length === 0 ? <Text style={{ color: colors.textMuted }}>Lägg till minst två plagg för att få outfitförslag.</Text> : null}
        {looks.map((outfit) => (
          <View key={outfit.title} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.outfitName, { color: colors.text }]}>{outfit.title}</Text>
                <Text style={[styles.detail, { color: colors.textMuted }]}>{outfit.reason}</Text>
              </View>
              <View style={[styles.match, { backgroundColor: colors.accent }]}><Ionicons name="star" size={10} color={colors.accentText} /><Text style={[styles.matchText, { color: colors.accentText }]}>{outfit.matchPercent}%</Text></View>
            </View>
            <View style={styles.images}>
              {outfit.items.map((item) => (
                item.image
                  ? <Image key={item.id} source={{ uri: item.image }} style={styles.image} />
                  : <View key={item.id} style={[styles.image, { backgroundColor: colors.input }]} />
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
  content: { padding: Spacing.lg, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '500' },
  subtitle: { fontSize: 11, marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  card: { borderRadius: 22, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  outfitName: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 10, marginTop: 4, maxWidth: 220, lineHeight: 14 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 15, paddingHorizontal: 9, paddingVertical: 6 },
  matchText: { fontSize: 10, fontWeight: '700' },
  images: { flexDirection: 'row', gap: 8 },
  image: { flex: 1, height: 145, borderRadius: 14 },
});
