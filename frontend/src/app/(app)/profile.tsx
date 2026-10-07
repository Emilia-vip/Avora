import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GenderCard } from '@/components/profile/gender-card';
import { profileStyles } from '@/components/profile/profile-card';
import { ProfileHero } from '@/components/profile/profile-hero';
import { ProfileStats } from '@/components/profile/profile-stats';
import { SettingsList, type SettingRow } from '@/components/profile/settings-list';
import { StyleDnaCard } from '@/components/profile/style-dna-card';
import { cardSurface, displayTitle, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWardrobe, type WardrobeItem } from '@/hooks/use-wardrobe';
import { genderFromUser, genderLabel, type GenderValue } from '@/lib/gender';
import { setDailyAiNotificationEnabled } from '@/lib/local-notifications';
import { avatarPathFromUser, resolveAvatarUrl, uploadProfileAvatar } from '@/lib/profile-avatar';
import { userDisplayName } from '@/lib/user-name';
import { setUserSetting, type UserSettings } from '@/lib/user-settings';

export default function Profile() {
  const { logout, deleteAccount, updateStyleDna, updateGender, user } = useAuth();
  const colors = useAppTheme();
  const displayName = userDisplayName(user, 'Profile');
  const email = typeof user?.email === 'string' ? user.email : 'you@mail.com';
  const { items, settings: userSettings, setSettings: setUserSettings } = useWardrobe();

  const [isEditingStyleDna, setIsEditingStyleDna] = useState(false);
  // Holds an optimistic choice while saving; otherwise the saved value on the user wins.
  const [pendingGender, setGender] = useState<GenderValue | null | undefined>(undefined);
  const gender = pendingGender !== undefined ? pendingGender : genderFromUser(user);
  const [genderSaving, setGenderSaving] = useState(false);
  const [savedAvatar, setSavedAvatar] = useState<{ path: string; url: string } | null>(null);
  const [pickedAvatarUri, setPickedAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const stats = useMemo(() => wardrobeStats(items), [items]);
  const styleTags = useMemo(() => {
    const saved = user?.user_metadata?.style_dna;
    return Array.isArray(saved) && saved.length ? saved.map(String).slice(0, 5) : topStyles(items);
  }, [user, items]);

  const avatarPath = avatarPathFromUser(user);
  useEffect(() => {
    if (!avatarPath) return;
    let active = true;
    resolveAvatarUrl(avatarPath)
      .then((url) => {
        if (active) setSavedAvatar({ path: avatarPath, url });
      })
      .catch(() => {
        // Falls back to a garment photo below.
      });
    return () => {
      active = false;
    };
  }, [avatarPath]);
  const savedAvatarUri = savedAvatar && savedAvatar.path === avatarPath ? savedAvatar.url : null;

  // Without a profile picture, show a favourite garment (or any garment) instead.
  const garmentAvatar = (items.find((item) => item.favorite && item.image) ?? items.find((item) => item.image))?.image ?? null;
  const avatarUri = pickedAvatarUri ?? savedAvatarUri ?? garmentAvatar;

  const toggleSetting = async (
    key: keyof UserSettings,
    title: string,
    labels: [on: string, off: string],
    sideEffect?: (next: boolean) => Promise<void>,
  ) => {
    const next = !userSettings[key];
    try {
      setUserSettings((previous) => ({ ...previous, [key]: next }));
      await setUserSetting(key, next);
      await sideEffect?.(next);
      Alert.alert(title, next ? labels[0] : labels[1]);
    } catch {
      Alert.alert(title, 'Could not save the setting.');
    }
  };

  const settingRows: SettingRow[] = [
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      hint: 'Daily reminders',
      right: userSettings.notificationsEnabled ? 'On' : 'Off',
      onPress: () => toggleSetting(
        'notificationsEnabled',
        'Notifications',
        ['Turned on. You will get a daily outfit reminder.', 'Turned off.'],
        setDailyAiNotificationEnabled,
      ),
    },
    {
      icon: 'sparkles-outline',
      label: 'AI Suggestions',
      hint: 'Looks from your wardrobe',
      right: userSettings.aiSuggestionsEnabled ? 'On' : 'Off',
      onPress: () => toggleSetting(
        'aiSuggestionsEnabled',
        'AI Suggestions',
        ['Turned on. The AI stylist builds your looks.', 'Turned off. Looks are picked on your phone.'],
      ),
    },
    {
      icon: 'cloud-done-outline',
      label: 'Cloud Sync',
      hint: 'Sync clothes between devices',
      right: userSettings.cloudSyncEnabled ? 'On' : 'Paused',
      onPress: () => toggleSetting(
        'cloudSyncEnabled',
        'Cloud Sync',
        ['Turned on. Your wardrobe syncs again.', 'Paused. You can browse your wardrobe offline but not add or change clothes.'],
      ),
    },
  ];

  const confirmDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(
      'Delete account?',
      'Your account, all your clothes and all your photos will be permanently deleted. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              // Signing out sends the app back to the login screen.
            } catch (error) {
              setDeleting(false);
              Alert.alert('Could not delete your account', error instanceof Error ? error.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleSelectGender = async (next: GenderValue) => {
    if (genderSaving || gender === next) return;
    const previous = gender;
    setGender(next);
    setGenderSaving(true);
    try {
      await updateGender(next);
    } catch {
      setGender(previous);
      Alert.alert('Could not save your gender.');
    } finally {
      setGenderSaving(false);
    }
  };

  const pickAvatarFromLibrary = async () => {
    if (!user) {
      Alert.alert('Sign in', 'You need to be signed in to change your profile picture.');
      return;
    }
    if (avatarUploading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const previous = pickedAvatarUri;
    setAvatarUploading(true);
    try {
      const localUri = result.assets[0].uri;
      setPickedAvatarUri(localUri);
      setPickedAvatarUri(await uploadProfileAvatar(user.id, localUri));
    } catch (error) {
      setPickedAvatarUri(previous);
      Alert.alert('Could not save your profile picture', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const softCard = cardSurface(colors);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Your style profile</Text>
            <Text style={[styles.pageTitle, { color: colors.text }]}>Profile</Text>
          </View>
          <Pressable
            style={[styles.iconButton, softCard]}
            accessibilityRole="button"
            accessibilityLabel="Edit Style DNA"
            onPress={() => {
              setIsEditingStyleDna(true);
              setTimeout(() => scrollRef.current?.scrollTo({ y: 280, animated: true }), 100);
            }}>
            <Ionicons name="create-outline" size={16} color={colors.text} />
          </Pressable>
        </View>

        <ProfileHero
          name={displayName}
          email={email}
          planLabel={stats.items >= 20 || stats.brands >= 5 ? 'Premium' : 'Member'}
          genderText={genderLabel(gender)}
          avatarUri={avatarUri}
          avatarUploading={avatarUploading}
          onPickAvatar={pickAvatarFromLibrary}
        />

        <ProfileStats
          stats={[
            { label: 'Items', value: stats.items, icon: 'shirt-outline' },
            { label: 'Favourites', value: stats.favorites, icon: 'heart-outline' },
            { label: 'Brands', value: stats.brands, icon: 'pricetag-outline' },
          ]}
        />

        <GenderCard value={gender} saving={genderSaving} onSelect={handleSelectGender} />

        <StyleDnaCard
          tags={styleTags}
          editing={isEditingStyleDna}
          onEditingChange={setIsEditingStyleDna}
          onSave={updateStyleDna}
        />

        <View style={styles.section}>
          <Text style={[profileStyles.kicker, { color: colors.accent }]}>Preferences</Text>
          <Text style={[profileStyles.title, { color: colors.text, marginBottom: 12 }]}>Settings</Text>
          <SettingsList rows={settingRows} />
        </View>

        <Pressable
          onPress={logout}
          style={({ pressed }) => [
            styles.logoutButton,
            softCard,
            { backgroundColor: pressed ? colors.input : colors.card },
          ]}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Sign out</Text>
        </Pressable>

        <Pressable onPress={confirmDeleteAccount} disabled={deleting} style={styles.deleteAccount}>
          <Text style={[styles.deleteAccountText, { color: colors.textMuted }]}>
            {deleting ? 'Deleting account…' : 'Delete account'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function wardrobeStats(items: WardrobeItem[]) {
  return {
    items: items.length,
    favorites: items.filter((item) => item.favorite).length,
    brands: new Set(items.map((item) => item.brand?.trim()).filter(Boolean)).size,
  };
}

/** Most common styles in the wardrobe, topped up with the most common categories. */
function topStyles(items: WardrobeItem[]) {
  const mostCommon = (values: (string | null | undefined)[]) => {
    const counts = new Map<string, number>();
    for (const value of values) {
      const text = (value ?? '').trim();
      if (text) counts.set(text, (counts.get(text) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([text]) => text);
  };

  const merged = mostCommon(items.map((item) => item.style));
  for (const category of mostCommon(items.map((item) => item.category))) {
    if (merged.length >= 5) break;
    if (!merged.includes(category)) merged.push(category);
  }
  return merged;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 130,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  pageTitle: {
    ...displayTitle,
    marginTop: 6,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 2,
  },
  logoutButton: {
    marginTop: 4,
    borderRadius: Radius.full,
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
  deleteAccount: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deleteAccountText: {
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
