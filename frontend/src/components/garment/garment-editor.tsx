import { Image } from 'expo-image';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

/** Garments start slightly smaller than the frame so they sit inside the guide line. */
const START_SCALE = 0.86;
const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
const SNAP_ROTATION = (4 * Math.PI) / 180;
const SNAP_CENTER = 8;

/** Size of the saved image; 3:4 like every wardrobe tile. */
const OUTPUT = { width: 900, height: 1200 };

export type GarmentEditorHandle = {
  /** Renders the garment exactly as positioned (without guides) to a transparent PNG and returns its file uri. */
  capture: () => Promise<string>;
  reset: () => void;
};

type GarmentEditorProps = {
  uri: string;
  ref?: Ref<GarmentEditorHandle>;
  /** Called with true while a finger is on the garment, so a parent ScrollView can stop scrolling. */
  onInteractionChange?: (active: boolean) => void;
};

export function GarmentEditor({ uri, ref, onInteractionChange = () => {} }: GarmentEditorProps) {
  const colors = useAppTheme();
  const canvasRef = useRef<View>(null);

  const scale = useSharedValue(START_SCALE);
  const savedScale = useSharedValue(START_SCALE);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);

  const reset = () => {
    scale.set(withSpring(START_SCALE));
    savedScale.set(START_SCALE);
    x.set(withSpring(0));
    y.set(withSpring(0));
    savedX.set(0);
    savedY.set(0);
    rotation.set(withSpring(0));
    savedRotation.set(0);
  };

  useImperativeHandle(ref, () => ({
    capture: async () => {
      const path = await captureRef(canvasRef, { format: 'png', quality: 1, result: 'tmpfile', ...OUTPUT });
      // iOS returns a bare path; without the scheme fetch() would treat it as a URL on the dev server.
      return path.startsWith('file://') ? path : `file://${path}`;
    },
    reset,
  }));

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onBegin(() => {
      scheduleOnRN(onInteractionChange, true);
    })
    .onFinalize(() => {
      scheduleOnRN(onInteractionChange, false);
    })
    .onUpdate((event) => {
      x.set(savedX.get() + event.translationX);
      y.set(savedY.get() + event.translationY);
    })
    .onEnd(() => {
      if (Math.abs(x.get()) < SNAP_CENTER) x.set(withSpring(0));
      if (Math.abs(y.get()) < SNAP_CENTER) y.set(withSpring(0));
      savedX.set(Math.abs(x.get()) < SNAP_CENTER ? 0 : x.get());
      savedY.set(Math.abs(y.get()) < SNAP_CENTER ? 0 : y.get());
    });

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.get() * event.scale)));
    })
    .onEnd(() => {
      savedScale.set(scale.get());
    });

  const rotate = Gesture.Rotation()
    .onUpdate((event) => {
      rotation.set(savedRotation.get() + event.rotation);
    })
    .onEnd(() => {
      // Snap back to straight when it is almost straight.
      if (Math.abs(rotation.get()) < SNAP_ROTATION) rotation.set(withSpring(0));
      savedRotation.set(Math.abs(rotation.get()) < SNAP_ROTATION ? 0 : rotation.get());
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd(reset);

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pan, pinch, rotate));

  const garmentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: scale.get() },
      { rotate: `${rotation.get()}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.frame, { backgroundColor: colors.garmentTile, borderColor: colors.border }]}>
        {/* Only this layer is captured, so the saved image is the garment on transparency. */}
        <View ref={canvasRef} collapsable={false} style={styles.canvas}>
          <Animated.View style={[StyleSheet.absoluteFill, garmentStyle]}>
            <Image source={{ uri }} style={styles.garment} contentFit="contain" />
          </Animated.View>
        </View>

        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.guide, { borderColor: colors.textMuted }]} />
          <View style={[styles.centerLine, { backgroundColor: colors.textMuted }]} />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  canvas: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  garment: {
    width: '100%',
    height: '100%',
  },
  guide: {
    position: 'absolute',
    top: '7%',
    bottom: '7%',
    left: '7%',
    right: '7%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    opacity: 0.35,
  },
  centerLine: {
    position: 'absolute',
    top: '7%',
    bottom: '7%',
    left: '50%',
    width: StyleSheet.hairlineWidth,
    opacity: 0.25,
  },
});
