export const GENDER_OPTIONS = [
  { value: 'female', label: 'Woman' },
  { value: 'male', label: 'Man' },
  { value: 'other', label: 'Other / prefer not to say' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'];

export function normalizeGender(value?: string | null): GenderValue | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (['female', 'kvinna', 'woman', 'f', 'w'].includes(raw)) return 'female';
  if (['male', 'man', 'boy', 'm'].includes(raw)) return 'male';
  if (/^(other|annat|non.?binary|nb|x)/.test(raw)) return 'other';
  return null;
}

export function genderLabel(value?: string | null) {
  const normalized = normalizeGender(value);
  if (!normalized) return 'Not specified';
  return GENDER_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Not specified';
}

export function genderFromUser(user: { user_metadata?: Record<string, unknown> } | null) {
  const meta = user?.user_metadata ?? {};
  return normalizeGender(
    typeof meta.gender === 'string'
      ? meta.gender
      : typeof meta.sex === 'string'
        ? meta.sex
        : null,
  );
}
