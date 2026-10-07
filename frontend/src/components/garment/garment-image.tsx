import { Image, type ImageProps } from 'expo-image';

/**
 * A garment photo cached on disk by its storage path rather than its URL. Signed URLs change every
 * hour, so caching by URL would download every photo again each time they are re-signed.
 */
export function GarmentImage({
  uri,
  path,
  ...props
}: Omit<ImageProps, 'source'> & { uri: string; path?: string | null }) {
  return (
    <Image
      {...props}
      source={{ uri, cacheKey: path ?? undefined }}
      cachePolicy="memory-disk"
      transition={150}
    />
  );
}
