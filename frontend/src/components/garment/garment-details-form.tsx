import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { CLOTHING_CATEGORIES } from '@/lib/clothing-category';

export type GarmentDetails = {
  name: string;
  category: string;
  brand: string;
  color: string;
  pattern: string;
  material: string;
  style: string;
  /** Comma-separated, e.g. "spring, autumn"; filled in by the AI. */
  season: string;
};

export const EMPTY_GARMENT_DETAILS: GarmentDetails = {
  name: '',
  category: 'Tops',
  brand: '',
  color: '',
  pattern: '',
  material: '',
  style: '',
  season: '',
};

const TEXT_FIELDS: { key: Exclude<keyof GarmentDetails, 'name' | 'category'>; placeholder: string }[] = [
  { key: 'brand', placeholder: 'Brand (optional)' },
  { key: 'color', placeholder: 'Colour' },
  { key: 'pattern', placeholder: 'Pattern, e.g. solid' },
  { key: 'material', placeholder: 'Material, e.g. cotton' },
  { key: 'style', placeholder: 'Style, e.g. casual' },
  { key: 'season', placeholder: 'Season, e.g. spring, autumn' },
];

export function GarmentDetailsForm({
  value,
  onChange,
}: {
  value: GarmentDetails;
  onChange: (patch: Partial<GarmentDetails>) => void;
}) {
  const colors = useAppTheme();
  const inputStyle = [styles.input, { backgroundColor: colors.card, borderColor: colors.card, color: colors.text }];

  return (
    <>
      <TextInput
        value={value.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="Garment name"
        placeholderTextColor={colors.textMuted}
        style={inputStyle}
      />
      <Text style={[styles.label, { color: colors.textMuted }]}>Category</Text>
      <View style={styles.categories}>
        {CLOTHING_CATEGORIES.map((category) => {
          const selected = value.category === category;
          return (
            <Pressable
              key={category}
              onPress={() => onChange({ category })}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.card,
                },
              ]}
            >
              <Text style={[styles.categoryText, { color: selected ? colors.onPrimary : colors.text }]}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>Details</Text>
      {TEXT_FIELDS.map((field) => (
        <TextInput
          key={field.key}
          value={value[field.key]}
          onChangeText={(text) => onChange({ [field.key]: text })}
          placeholder={field.placeholder}
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  input: {
    alignSelf: 'stretch',
    height: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: 18,
    fontSize: 15,
  },
  categories: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
