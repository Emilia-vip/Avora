import { supabase } from '@/lib/supabase';

export const WARDROBE_BUCKET = 'wardrobe-images';
const SIGNED_URL_SECONDS = 3600;
/** Drafts younger than this may still be on someone's Add screen, so the sweep leaves them alone. */
const ORPHAN_MIN_AGE_MS = 6 * 60 * 60 * 1000;

export function newImagePath(userId: string, extension: 'jpg' | 'png') {
  return `${userId}/${Date.now()}.${extension}`;
}

/** Signs every path in one request instead of one request per garment. */
export async function signedImageUrls(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (!unique.length) return urls;

  const { data, error } = await supabase.storage.from(WARDROBE_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error) throw error;
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

export async function signedImageUrl(path: string) {
  const { data, error } = await supabase.storage.from(WARDROBE_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not show the image.');
  return data.signedUrl;
}

export async function uploadImage(uri: string, path: string, contentType: string) {
  const response = await fetch(uri);
  const readType = response.headers.get('content-type') ?? '';
  if (!response.ok || readType.includes('text/html')) {
    throw new Error('Could not read the photo from your phone.');
  }
  const data = await response.arrayBuffer();
  if (!data.byteLength) throw new Error('The photo was empty.');
  const { error } = await supabase.storage.from(WARDROBE_BUCKET).upload(path, data, { contentType, upsert: false });
  if (error) throw error;
}

/** Best-effort: a leftover file is harmless, so failures are ignored. */
export function removeImages(paths: (string | null | undefined)[]) {
  const list = paths.filter((path): path is string => Boolean(path));
  if (list.length) void supabase.storage.from(WARDROBE_BUCKET).remove(list).catch(() => undefined);
}

/**
 * Deletes photos and cut-outs in the user's folder that no garment points to, e.g. from an
 * Add screen that was left without saving or an app that was closed mid-upload.
 * The profile picture lives in the same folder and is always kept.
 */
export async function cleanupOrphanImages(userId: string, keep: (string | null | undefined)[] = []) {
  try {
    const { data: rows, error } = await supabase
      .from('clothing_items')
      .select('image_path')
      .eq('user_id', userId);
    if (error) return;

    const used = new Set([...rows.map((row) => row.image_path), ...keep].filter(Boolean));
    const cutoff = Date.now() - ORPHAN_MIN_AGE_MS;
    const orphans: string[] = [];

    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: listError } = await supabase.storage
        .from(WARDROBE_BUCKET)
        .list(userId, { limit: 1000, offset });
      if (listError || !files?.length) break;

      for (const file of files) {
        const path = `${userId}/${file.name}`;
        const created = Date.parse(file.created_at ?? '');
        if (!file.id || file.name.startsWith('avatar') || used.has(path)) continue;
        if (Number.isNaN(created) || created > cutoff) continue;
        orphans.push(path);
      }
      if (files.length < 1000) break;
    }

    removeImages(orphans);
  } catch {
    // Best-effort.
  }
}
