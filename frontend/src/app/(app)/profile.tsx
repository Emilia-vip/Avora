import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { setDailyAiNotificationEnabled } from '@/lib/local-notifications';
import {
  avatarPathFromUser,
  resolveAvatarUrl,
  uploadProfileAvatar,
} from '@/lib/profile-avatar';
import { supabase } from '@/lib/supabase';
import { userDisplayName } from '@/lib/user-name';
import { loadUserSettings, setUserSetting, type UserSettings } from '@/lib/user-settings';
import { loadWardrobeCache } from '@/lib/wardrobe-cache';

const STYLE_DNA_OPTIONS = [
  'Smart Casual',
  'Modern Classic',
  'Casual Everyday',
  'Soft Tailoring',
  'Normcore',
  'Contemporary Preppy',
  'Monokrom Bas',
  'Business Casual',
  'Weekend Leisure',
  'Workwear Casual',
  'Minimalist',
  'Scandinavian',
  'Neutral Palette',
  'Elevated Basics',
  'Clean Lines',
] as const;

const STAT_ICONS = {
  Items: 'shirt-outline',
  Outfits: 'heart-outline',
  Brands: 'pricetag-outline',
} as const;

export default function Profile() {
  const { logout, updateStyleDna, user } = useAuth();
  const colors = useAppTheme();
  const displayName = userDisplayName(user, 'Profil');
  const email = typeof user?.email === 'string' ? user.email : 'you@mail.com';

  const [userSettings, setUserSettings] = useState<UserSettings>({
    notificationsEnabled: true,
    aiSuggestionsEnabled: true,
    cloudSyncEnabled: true,
  });

  const [stats, setStats] = useState<Array<{ label: string; value: string }>>([
    { label: 'Items', value: '0' },
    { label: 'Outfits', value: '0' },
    { label: 'Brands', value: '0' },
  ]);

  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [isEditingStyleDna, setIsEditingStyleDna] = useState(false);
  const [styleDnaDraft, setStyleDnaDraft] = useState<string[]>([]);
  const [styleDnaSaving, setStyleDnaSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [planLabel, setPlanLabel] = useState('Member');

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    loadUserSettings()
      .then((s) => {
        if (!active) return;
        setUserSettings(s);
      })
      .catch(() => {
        // Keep defaults if secure storage fails.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadProfileData = async () => {
      if (!user) return;

      try {
        const items = userSettings.cloudSyncEnabled
          ? await (async () => {
              const { data, error } = await supabase
                .from('clothing_items')
                .select('brand, category, style, favorite, image_path')
                .eq('user_id', user.id);
              if (error || !data) return [];
              return data.map((item) => ({ ...item, image: null }));
            })()
          : await (async () => {
              const cached = await loadWardrobeCache();
              return cached.map((item) => ({
                brand: item.brand ?? null,
                category: item.category,
                style: item.style ?? null,
                favorite: Boolean(item.favorite),
                image_path: null,
                image: item.image ?? null,
              }));
            })();

        if (!active) return;

        const itemsCount = items.length;
        const brandsCount = new Set(
          items.map((i: any) => i.brand).filter((v: any) => typeof v === 'string' && v.trim().length > 0),
        ).size;
        const favoritesCount = items.filter((i: any) => Boolean(i.favorite)).length;

        setStats([
          { label: 'Items', value: String(itemsCount) },
          { label: 'Outfits', value: String(favoritesCount) },
          { label: 'Brands', value: String(brandsCount) },
        ]);

        const toCountMap = (values: Array<string | null | undefined>) => {
          const map = new Map<string, number>();
          for (const v of values) {
            const s = (v ?? '').trim();
            if (!s) continue;
            map.set(s, (map.get(s) ?? 0) + 1);
          }
          return map;
        };

        const styleMap = toCountMap(items.map((i: any) => i.style));
        const topStyles = [...styleMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([value]) => value);

        const categoryMap = toCountMap(items.map((i: any) => i.category));
        const topCategories = [...categoryMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([value]) => value);

        const merged = [...topStyles];
        for (const c of topCategories) {
          if (merged.length >= 5) break;
          if (!merged.includes(c)) merged.push(c);
        }

        const styleDnaFromProfile = (user.user_metadata as any)?.style_dna;
        if (Array.isArray(styleDnaFromProfile) && styleDnaFromProfile.length) {
          setStyleTags(styleDnaFromProfile.map(String).slice(0, 5));
        } else {
          setStyleTags(merged);
        }

        const computedPlan = itemsCount >= 20 || brandsCount >= 5 ? 'Premium' : 'Member';
        setPlanLabel(computedPlan);

        const savedAvatarPath = avatarPathFromUser(user);
        if (savedAvatarPath) {
          try {
            const url = await resolveAvatarUrl(savedAvatarPath);
            if (active) setAvatarUri(url);
            return;
          } catch {
            // Fall through to wardrobe fallback if signed URL fails.
          }
        }

        if (userSettings.cloudSyncEnabled) {
          const preferred =
            items.find((i: any) => Boolean(i.favorite) && typeof i.image_path === 'string' && i.image_path) ??
            items.find((i: any) => typeof i.image_path === 'string' && i.image_path) ??
            null;

          if (preferred?.image_path) {
            const signed = await supabase.storage
              .from('wardrobe-images')
              .createSignedUrl(preferred.image_path, 3600);
            if (!active) return;
            setAvatarUri(signed.data?.signedUrl ?? null);
          } else if (active) {
            setAvatarUri(null);
          }
        } else {
          const preferred =
            items.find((i: any) => Boolean(i.favorite) && i.image) ??
            items.find((i: any) => i.image) ??
            null;
          if (active) setAvatarUri(preferred?.image ?? null);
        }
      } catch {
        // Best-effort: keep existing UI.
      }
    };

    void loadProfileData();
    return () => {
      active = false;
    };
  }, [user, userSettings.cloudSyncEnabled]);

  const settings = [
    {
      icon: 'notifications-outline' as const,
      label: 'Notifications',
      hint: 'Dagliga påminnelser',
      right: userSettings.notificationsEnabled ? 'On' : 'Off',
      onPress: async () => {
        const next = !userSettings.notificationsEnabled;
        try {
          setUserSettings((prev) => ({ ...prev, notificationsEnabled: next }));
          await setUserSetting('notificationsEnabled', next);
          await setDailyAiNotificationEnabled(next);
          Alert.alert('Notifications', next ? 'På' : 'Av');
        } catch {
          Alert.alert('Notifications', 'Kunde inte spara.');
        }
      },
    },
    {
      icon: 'sparkles-outline' as const,
      label: 'AI Suggestions',
      hint: 'Looks från garderoben',
      right: userSettings.aiSuggestionsEnabled ? 'Daily' : 'Off',
      onPress: async () => {
        const next = !userSettings.aiSuggestionsEnabled;
        try {
          setUserSettings((prev) => ({ ...prev, aiSuggestionsEnabled: next }));
          await setUserSetting('aiSuggestionsEnabled', next);
          Alert.alert('AI Suggestions', next ? 'På (Daily)' : 'Av');
        } catch {
          Alert.alert('AI Suggestions', 'Kunde inte spara.');
        }
      },
    },
    {
      icon: 'cloud-done-outline' as const,
      label: 'Cloud Sync',
      hint: 'Synka plagg mellan enheter',
      right: userSettings.cloudSyncEnabled ? 'Active' : 'Paused',
      onPress: async () => {
        const next = !userSettings.cloudSyncEnabled;
        try {
          setUserSettings((prev) => ({ ...prev, cloudSyncEnabled: next }));
          await setUserSetting('cloudSyncEnabled', next);
          Alert.alert('Cloud Sync', next ? 'Active' : 'Paused');
        } catch {
          Alert.alert('Cloud Sync', 'Kunde inte spara.');
        }
      },
    },
    {
      icon: 'settings-outline' as const,
      label: 'App Settings',
      hint: 'Mer kontroll snart',
      right: undefined,
      onPress: async () => {
        Alert.alert('App Settings', 'Kommer snart.');
      },
    },
  ];

  const toggleStyleDnaDraft = (option: string) => {
    setStyleDnaDraft((prev) => {
      if (prev.includes(option)) return prev.filter((s) => s !== option);
      if (prev.length >= 5) {
        Alert.alert('Max 5 stilar');
        return prev;
      }
      return [...prev, option];
    });
  };

  const handleSaveStyleDna = async () => {
    if (styleDnaDraft.length === 0) {
      Alert.alert('Välj minst en Style DNA');
      return;
    }

    setStyleDnaSaving(true);
    try {
      await updateStyleDna(styleDnaDraft);
      setStyleTags(styleDnaDraft);
      setIsEditingStyleDna(false);
      Alert.alert('Sparat', 'Din Style DNA är uppdaterad.');
    } catch {
      Alert.alert('Kunde inte spara Style DNA.');
    } finally {
      setStyleDnaSaving(false);
    }
  };

  const pickAvatarFromLibrary = async () => {
    if (!user) {
      Alert.alert('Logga in', 'Du måste vara inloggad för att byta profilbild.');
      return;
    }
    if (avatarUploading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Tillstånd krävs',
        'Tillåt åtkomst till foton för att välja en profilbild.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setAvatarUploading(true);
    try {
      const localUri = result.assets[0].uri;
      setAvatarUri(localUri);
      const uploadedUrl = await uploadProfileAvatar(user.id, localUri);
      setAvatarUri(uploadedUrl);
    } catch (error) {
      Alert.alert(
        'Kunde inte spara profilbild',
        error instanceof Error ? error.message : 'Försök igen.',
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const softCard = {
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Din stilprofil</Text>
            <Text style={[styles.pageTitle, { color: colors.text }]}>Profil</Text>
          </View>
          <Pressable
            style={[styles.iconButton, softCard]}
            onPress={() => {
              setStyleDnaDraft(styleTags);
              setIsEditingStyleDna(true);
              setTimeout(() => scrollRef.current?.scrollTo({ y: 280, animated: true }), 100);
            }}>
            <Ionicons name="create-outline" size={16} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.heroCard, softCard]}>
          <View style={styles.profileRow}>
            <Pressable
              onPress={pickAvatarFromLibrary}
              disabled={avatarUploading}
              style={styles.avatarOuter}
              accessibilityRole="button"
              accessibilityLabel="Byt profilbild">
              <View style={[styles.avatarWrap, { backgroundColor: colors.input }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.input }]}>
                    <Text style={[styles.avatarFallbackText, { color: colors.text }]}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {avatarUploading ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
              <View style={[styles.avatarBadge, { backgroundColor: colors.accent }]}>
                <Ionicons name="camera" size={11} color={colors.accentText} />
              </View>
            </Pressable>

            <View style={styles.nameBlock}>
              <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
              <Text style={[styles.email, { color: colors.textMuted }]}>{email}</Text>
              <View style={[styles.planPill, { backgroundColor: colors.input }]}>
                <View style={[styles.planDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.planText, { color: colors.text }]}>{planLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={[styles.statCard, softCard]}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.input }]}>
                <Ionicons
                  name={STAT_ICONS[stat.label as keyof typeof STAT_ICONS] ?? 'ellipse-outline'}
                  size={14}
                  color={colors.accent}
                />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.styleCard, softCard]}>
          <View style={styles.styleDnaHeader}>
            <View>
              <Text style={[styles.sectionKicker, { color: colors.accent }]}>Garderobsvibe</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Style DNA</Text>
            </View>
            <Pressable
              onPress={() => {
                if (isEditingStyleDna) {
                  setIsEditingStyleDna(false);
                  return;
                }
                setStyleDnaDraft(styleTags);
                setIsEditingStyleDna(true);
              }}
              style={({ pressed }) => [
                styles.styleDnaEditButton,
                { backgroundColor: pressed ? colors.input : colors.input },
              ]}>
              <Ionicons
                name={isEditingStyleDna ? 'close' : 'create-outline'}
                size={15}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          {isEditingStyleDna ? (
            <View style={{ gap: Spacing.md }}>
              <Text style={[styles.styleHint, { color: colors.textMuted }]}>
                Välj upp till 5 stilar som speglar din garderob.
              </Text>
              <View style={styles.tagWrap}>
                {STYLE_DNA_OPTIONS.map((option) => {
                  const selected = styleDnaDraft.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => toggleStyleDnaDraft(option)}
                      style={[
                        styles.tag,
                        selected
                          ? { backgroundColor: colors.primary }
                          : { backgroundColor: colors.input },
                      ]}>
                      <Text
                        style={[
                          styles.tagText,
                          { color: selected ? colors.onPrimary : colors.text },
                        ]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.styleDnaActions}>
                <Pressable
                  onPress={() => {
                    setIsEditingStyleDna(false);
                    setStyleDnaDraft([]);
                  }}
                  style={({ pressed }) => [
                    styles.styleDnaCancel,
                    { backgroundColor: pressed ? colors.input : colors.input },
                  ]}>
                  <Text style={[styles.styleDnaCancelText, { color: colors.textMuted }]}>Ångra</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveStyleDna}
                  disabled={styleDnaSaving}
                  style={({ pressed }) => [
                    styles.styleDnaSave,
                    {
                      backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                      opacity: styleDnaSaving ? 0.65 : 1,
                    },
                  ]}>
                  <Text style={[styles.styleDnaSaveText, { color: colors.onPrimary }]}>
                    {styleDnaSaving ? 'Sparar...' : 'Spara'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : styleTags.length > 0 ? (
            <View style={styles.tagWrap}>
              {styleTags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.input }]}>
                  <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.styleHint, { color: colors.textMuted }]}>
              Lägg till plagg eller redigera för att bygga din Style DNA.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionKicker, { color: colors.accent }]}>Preferenser</Text>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Inställningar</Text>
          <View style={[styles.settingsCard, softCard]}>
            {settings.map((item, idx) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={[
                  styles.settingRow,
                  idx !== settings.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}>
                <View style={[styles.settingIcon, { backgroundColor: colors.input }]}>
                  <Ionicons name={item.icon} size={16} color={colors.accent} />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.settingHint, { color: colors.textMuted }]}>{item.hint}</Text>
                </View>
                <View style={styles.settingRight}>
                  {item.right ? (
                    <Text style={[styles.settingMeta, { color: colors.textMuted }]}>{item.right}</Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={logout}
          style={({ pressed }) => [
            styles.logoutButton,
            softCard,
            { backgroundColor: pressed ? colors.input : colors.card },
          ]}>
          <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.logoutText, { color: colors.textMuted }]}>Logga ut</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: Radius.xl,
    padding: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarOuter: {
    width: 84,
    height: 84,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 26,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44, 36, 38, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13,
    marginBottom: 6,
  },
  planPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  planDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  planText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  styleCard: {
    borderRadius: Radius.xl,
    padding: 18,
    gap: 14,
  },
  section: {
    gap: 2,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  styleHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: Radius.full,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  styleDnaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  styleDnaEditButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleDnaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  styleDnaCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleDnaCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  styleDnaSave: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleDnaSaveText: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingsCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingHint: {
    fontSize: 12,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 4,
    borderRadius: 18,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
