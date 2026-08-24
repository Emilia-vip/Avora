import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const outfits = [
  { name: 'Warm Summer Day', detail: '24 C Sunny  ·  Casual', match: '94%', images: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=200&h=250&fit=crop&auto=format', 'https://images.unsplash.com/photo-1594938298603-c8148c4b4de1?w=200&h=250&fit=crop&auto=format', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=250&fit=crop&auto=format'] },
  { name: 'Dinner Date', detail: '18 C Clear  ·  Evening', match: '89%', images: ['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=200&h=250&fit=crop&auto=format', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=250&fit=crop&auto=format', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=200&h=250&fit=crop&auto=format'] },
  { name: 'Business Meeting', detail: 'Any weather  ·  Professional', match: '91%', images: ['https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=250&fit=crop&auto=format', 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=200&h=250&fit=crop&auto=format', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=250&fit=crop&auto=format'] },
];

export default function Outfits() {
  const colors = useAppTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Outfits</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Curated from your wardrobe</Text>
          </View>
          <View style={[styles.iconButton, { backgroundColor: colors.card }]}><Ionicons name="sparkles-outline" size={19} color={colors.text} /></View>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your suggestions</Text>
        {outfits.map((outfit) => (
          <View key={outfit.name} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View><Text style={[styles.outfitName, { color: colors.text }]}>{outfit.name}</Text><Text style={[styles.detail, { color: colors.textMuted }]}>{outfit.detail}</Text></View>
              <View style={[styles.match, { backgroundColor: colors.accent }]}><Ionicons name="star" size={10} color={colors.accentText} /><Text style={[styles.matchText, { color: colors.accentText }]}>{outfit.match}</Text></View>
            </View>
            <View style={styles.images}>{outfit.images.map((image) => <Image key={image} source={{ uri: image }} style={styles.image} />)}</View>
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
  detail: { fontSize: 10, marginTop: 4 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 15, paddingHorizontal: 9, paddingVertical: 6 },
  matchText: { fontSize: 10, fontWeight: '700' },
  images: { flexDirection: 'row', gap: 8 },
  image: { flex: 1, height: 145, borderRadius: 14 },
});
