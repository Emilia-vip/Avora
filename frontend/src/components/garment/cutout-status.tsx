import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

export type CutoutStatus = 'idle' | 'working' | 'done' | 'failed';

/** One line under the photo telling what the AI cut-out is doing, with toggle/retry actions. */
export function CutoutStatusRow({
  status,
  error,
  showOriginal,
  onToggleOriginal,
  onRetry,
}: {
  status: CutoutStatus;
  error: string | null;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  onRetry?: () => void;
}) {
  const colors = useAppTheme();

  return (
    <View style={styles.row}>
      {status === 'working' ? (
        <>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.text, { color: colors.textMuted }]}>AI klipper ut plagget…</Text>
        </>
      ) : status === 'done' ? (
        <>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <Text style={[styles.text, { color: colors.text }]}>
            {showOriginal ? 'Originalbild' : 'Urklippt av AI'}
          </Text>
          <Pressable onPress={onToggleOriginal} hitSlop={8}>
            <Text style={[styles.action, { color: colors.accent }]}>
              {showOriginal ? 'Visa urklipp' : 'Visa original'}
            </Text>
          </Pressable>
        </>
      ) : status === 'failed' ? (
        <>
          <Text style={[styles.text, { color: colors.textMuted }]}>
            {error
              ? `${error} Du kan spara bilden som den är.`
              : 'Kunde inte klippa ut plagget – du kan fortfarande justera och spara bilden.'}
          </Text>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={[styles.action, { color: colors.accent }]}>Försök igen</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 20,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  action: {
    fontSize: 13,
    fontWeight: '600',
  },
});
