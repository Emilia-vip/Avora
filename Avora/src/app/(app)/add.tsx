import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function Add() {
  const colors = useAppTheme();

  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const takePhoto = async () => {
    const { status } =
      await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Kameratillstånd krävs',
        'Tillåt kamera för att fotografera dina kläder.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={styles.container}>
        <Text
          style={[
            styles.title,
            { color: colors.text },
          ]}
        >
          Lägg till plagg
        </Text>

        {photoUri ? (
          <>
            <Image
              source={{ uri: photoUri }}
              style={styles.preview}
              contentFit="cover"
            />

            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={takePhoto}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: colors.onPrimary,
                  },
                ]}
              >
                Ta ny bild
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              Fotografera ett plagg mot en enkel bakgrund.
            </Text>

            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={takePhoto}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: colors.onPrimary,
                  },
                ]}
              >
                Ta foto
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  container: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  preview: {
    width: '100%',
    height: 360,
    borderRadius: 16,
  },

  button: {
    alignSelf: 'stretch',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});