export const GENDER_OPTIONS = [
  { value: 'female', label: 'Kvinna' },
  { value: 'male', label: 'Man' },
  { value: 'other', label: 'Annat / vill ej ange' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'];

export function normalizeGender(value?: string | null): GenderValue | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (/(female|kvinna|woman|f|w)/.test(raw) || raw === 'kvinna') return 'female';
  if (/(male|man|boy|m)/.test(raw) && !/female|woman/.test(raw)) return 'male';
  if (/(other|annat|non.?binary|nb|x)/.test(raw)) return 'other';
  if (raw === 'female' || raw === 'male' || raw === 'other') return raw;
  return null;
}

export function genderLabel(value?: string | null) {
  const normalized = normalizeGender(value);
  if (!normalized) return 'Ej angivet';
  return GENDER_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Ej angivet';
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
