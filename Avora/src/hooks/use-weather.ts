import { useEffect, useState } from 'react';

import { loadCurrentWeather, type WeatherSnapshot } from '@/lib/weather';

export function useWeather() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    loadCurrentWeather()
      .then((value) => {
        if (active) setWeather(value);
      })
      .catch(() => {
        if (active) setWeather(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return weather;
}
