import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class GarmentCutoutModule extends NativeModule {
  isAvailable(): boolean;
  cutOutAsync(uri: string): Promise<string>;
}

// Optional: Expo Go doesn't include this module, so callers fall back to the server there.
const native = requireOptionalNativeModule<GarmentCutoutModule>('GarmentCutout');

/** True when this build can cut out garments on the phone itself (development build; iOS 17+ or Android). */
export function canCutOutOnDevice() {
  return native?.isAvailable() ?? false;
}

/** Cuts the garment out of a local photo and returns a file:// URI to a transparent PNG. */
export function cutOutOnDevice(uri: string) {
  if (!native) throw new Error('On-device cut-out is not available in this build.');
  return native.cutOutAsync(uri);
}
