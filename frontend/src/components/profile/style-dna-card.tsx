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
        Alert.alert(`Max ${MAX_STYLES} stilar`);
        return previous;
      }
      return [...previous, option];
    });
  };

  const save = async () => {
    if (draft.length === 0) {
      Alert.alert('Välj minst en Style DNA');
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
      Alert.alert('Sparat', 'Din Style DNA är uppdaterad.');
    } catch {
      Alert.alert('Kunde inte spara Style DNA.');
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
    <ProfileCard kicker="Garderobsvibe" title="Style DNA" action={editButton}>
      {editing ? (
        <View style={{ gap: Spacing.md }}>
          <Text style={[profileStyles.hint, { color: colors.textMuted }]}>
            Välj upp till {MAX_STYLES} stilar som speglar din garderob.
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
              <Text style={[styles.actionText, { color: colors.textMuted }]}>Ångra</Text>
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
                {saving ? 'Sparar...' : 'Spara'}
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
          Lägg till plagg eller redigera för att bygga din Style DNA.
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
