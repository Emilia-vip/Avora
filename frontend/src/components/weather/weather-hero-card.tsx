import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { WeatherSnapshot } from '@/lib/weather';

export function WeatherHeroCard({ weather }: { weather: WeatherSnapshot | null }) {
  const colors = useAppTheme();

  return (
    <View style={styles.tile}>
      <Ionicons name={weather?.icon ?? 'partly-sunny'} size={18} color={colors.accent} />
      <Text style={[styles.temp, { color: colors.text }]}>
        {weather ? `${weather.temperatureC}°` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  temp: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
