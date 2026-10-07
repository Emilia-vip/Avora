import { Text, View } from 'react-native';

import { ProfileCard, profileStyles, Tag } from '@/components/profile/profile-card';
import { useAppTheme } from '@/hooks/use-app-theme';
import { GENDER_OPTIONS, type GenderValue } from '@/lib/gender';

export function GenderCard({
  value,
  saving,
  onSelect,
}: {
  value: GenderValue | null;
  saving: boolean;
  onSelect: (value: GenderValue) => void;
}) {
  const colors = useAppTheme();
  return (
    <ProfileCard kicker="Profile" title="Gender">
      <Text style={[profileStyles.hint, { color: colors.textMuted }]}>
        The AI uses this to make outfit ideas more relevant.
      </Text>
      <View style={profileStyles.tagWrap}>
        {GENDER_OPTIONS.map((option) => (
          <Tag
            key={option.value}
            label={option.label}
            selected={value === option.value}
            disabled={saving}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </View>
    </ProfileCard>
  );
}
