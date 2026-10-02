import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'wardrobe-images';

export function avatarStoragePath(userId: string) {
  return `${userId}/avatar.jpg`;
}

export function avatarPathFromUser(user: { user_metadata?: Record<string, unknown> } | null) {
  const path = user?.user_metadata?.avatar_path;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

export async function resolveAvatarUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadProfileAvatar(userId: string, localUri: string) {
  const response = await fetch(localUri);
  const imageData = await response.arrayBuffer();
  const path = avatarStoragePath(userId);

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, imageData, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_path: path },
  });

  if (updateError) throw updateError;

  return resolveAvatarUrl(path);
}
