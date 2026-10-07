import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileCard, profileStyles, Tag } from '@/components/profile/profile-card';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const STYLE_DNA_OPTIONS = [
  'Smart Casual',
  'Modern Classic',
  'Casual Everyday',
  'Soft Tailoring',
  'Normcore',
  'Contemporary Preppy',
  'Monochrome Basics',
  'Business Casual',
  'Weekend Leisure',
  'Workwear Casual',
  'Minimalist',
  'Scandinavian',
  'Neutral Palette',
  'Elevated Basics',
  'Clean Lines',
] as const;

const MAX_STYLES = 5;

export function StyleDnaCard({
  tags,
  editing,
  onEditingChange,
  onSave,
}: {
  tags: string[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave: (tags: string[]) => Promise<void>;
}) {
  const colors = useAppTheme();
  // null = untouched, so editing always starts from what is saved.
  const [changes, setChanges] = useState<string[] | null>(null);
  const draft = changes ?? tags;
  const [saving, setSaving] = useState(false);

  const setEditing = (next: boolean) => {
    setChanges(null);
    onEditingChange(next);
  };

  const toggle = (option: string) => {
    setChanges((current) => {
      const previous = current ?? tags;
      if (previous.includes(option)) return previous.filter((value) => value !== option);
      if (previous.length >= MAX_STYLES) {
        Alert.alert(`You can pick up to ${MAX_STYLES} styles`);
        return previous;
      }
      return [...previous, option];
    });
  };

  const save = async () => {
    if (draft.length === 0) {
      Alert.alert('Pick at least one style');
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
      Alert.alert('Saved', 'Your Style DNA has been updated.');
    } catch {
      Alert.alert('Could not save your Style DNA.');
    } finally {
      setSaving(false);
    }
  };

  const editButton = (
    <Pressable
      onPress={() => setEditing(!editing)}
      style={[styles.editButton, { backgroundColor: colors.input }]}>
      <Ionicons name={editing ? 'close' : 'create-outline'} size={15} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <ProfileCard kicker="Wardrobe vibe" title="Style DNA" action={editButton}>
      {editing ? (
        <View style={{ gap: Spacing.md }}>
          <Text style={[profileStyles.hint, { color: colors.textMuted }]}>
            Pick up to {MAX_STYLES} styles that reflect your wardrobe.
          </Text>
          <View style={profileStyles.tagWrap}>
            {STYLE_DNA_OPTIONS.map((option) => (
              <Tag key={option} label={option} selected={draft.includes(option)} onPress={() => toggle(option)} />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => setEditing(false)}
              style={[styles.action, { backgroundColor: colors.input }]}>
              <Text style={[styles.actionText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving}
              style={({ pressed }) => [
                styles.action,
                {
                  backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                  opacity: saving ? 0.65 : 1,
                },
              ]}>
              <Text style={[styles.actionText, { color: colors.onPrimary }]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : tags.length > 0 ? (
        <View style={profileStyles.tagWrap}>
          {tags.map((tag) => (
            <Tag key={tag} label={tag} muted />
          ))}
        </View>
      ) : (
        <Text style={[profileStyles.hint, { color: colors.textMuted }]}>
          Add clothes or tap edit to build your Style DNA.
        </Text>
      )}
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
