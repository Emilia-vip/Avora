import type { User } from '@supabase/supabase-js';

export function userDisplayName(user: User | null | undefined, fallback = 'set your name in settings in your profile') {
  const raw = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  if (typeof raw !== 'string') return fallback;
  const name = raw.trim();
  if (!name) return fallback;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
