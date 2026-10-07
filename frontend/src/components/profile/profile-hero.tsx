import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export function ProfileHero({
  name,
  email,
  planLabel,
  genderText,
  avatarUri,
  avatarUploading,
  onPickAvatar,
}: {
  name: string;
  email: string;
  planLabel: string;
  genderText: string;
  avatarUri: string | null;
  avatarUploading: boolean;
  onPickAvatar: () => void;
}) {
  const colors = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.hero }]}>
      <View style={styles.row}>
        <Pressable
          onPress={onPickAvatar}
          disabled={avatarUploading}
          style={styles.avatarOuter}
          accessibilityRole="button"
          accessibilityLabel="Byt profilbild">
          <View style={[styles.avatarWrap, { backgroundColor: colors.heroOverlay }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.avatarFallbackText, { color: colors.accent }]}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {avatarUploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.onPrimary} />
              </View>
            ) : null}
          </View>
          <View style={[styles.avatarBadge, { backgroundColor: colors.accent, borderColor: colors.hero }]}>
            <Ionicons name="camera" size={11} color={colors.accentText} />
          </View>
        </Pressable>

        <View style={styles.nameBlock}>
          <Text style={[styles.name, { color: colors.onHero }]}>{name}</Text>
          <Text style={[styles.email, { color: colors.onHeroMuted }]}>{email}</Text>
          <View style={[styles.planPill, { backgroundColor: colors.heroOverlay }]}>
            <View style={[styles.planDot, { backgroundColor: colors.heroAccent }]} />
            <Text style={[styles.planText, { color: colors.onHero }]}>{planLabel}</Text>
          </View>
          <Text style={[styles.genderMeta, { color: colors.onHeroMuted }]}>{genderText}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: 22,
  },
  row: {
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
    borderRadius: 42,
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
    fontFamily: Fonts.display,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(44, 36, 38, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
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
  genderMeta: {
    fontSize: 12,
    marginTop: 6,
  },
});
