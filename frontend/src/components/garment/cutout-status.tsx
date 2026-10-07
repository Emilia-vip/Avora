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
          <Text style={[styles.text, { color: colors.textMuted }]}>AI is cutting out the garment…</Text>
        </>
      ) : status === 'done' ? (
        <>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <Text style={[styles.text, { color: colors.text }]}>
            {showOriginal ? 'Original photo' : 'Cut out by AI'}
          </Text>
          <Pressable onPress={onToggleOriginal} hitSlop={8}>
            <Text style={[styles.action, { color: colors.accent }]}>
              {showOriginal ? 'Show cut-out' : 'Show original'}
            </Text>
          </Pressable>
        </>
      ) : status === 'failed' ? (
        <>
          <Text style={[styles.text, { color: colors.textMuted }]}>
            {error
              ? `${error} You can save the photo as it is.`
              : 'Could not cut out the garment. You can still adjust and save the photo.'}
          </Text>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={[styles.action, { color: colors.accent }]}>Try again</Text>
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
