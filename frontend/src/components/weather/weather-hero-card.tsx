import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { WeatherSnapshot } from '@/lib/weather';

export function WeatherHeroCard({ weather }: { weather: WeatherSnapshot | null }) {
  const colors = useAppTheme();

  return (
    <View style={styles.tile}>
      <Ionicons name={weather?.icon ?? 'partly-sunny'} size={16} color={colors.text} />
      <Text style={[styles.temp, { color: colors.text }]}>
        {weather ? `${weather.temperatureC}°` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  temp: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
});
