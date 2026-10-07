import * as Location from 'expo-location';

export type WeatherSnapshot = {
  temperatureC: number;
  highC: number;
  lowC: number;
  placeName: string;
  label: string;
  icon:
    | 'sunny'
    | 'partly-sunny'
    | 'cloudy'
    | 'rainy'
    | 'snow'
    | 'thunderstorm';
  isRainy: boolean;
  isCold: boolean;
  isWarm: boolean;
  isDay: boolean;
  gradient: [string, string];
  summary: string;
};

const STOCKHOLM = { latitude: 59.3293, longitude: 18.0686 };

export async function loadCurrentWeather(): Promise<WeatherSnapshot> {
  const coords = await getCoordinates();
  return fetchWeather(coords.latitude, coords.longitude);
}

async function getCoordinates() {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return STOCKHOLM;

    // A recent cached position is instant; otherwise ask for a fresh one but don't wait forever.
    const cached = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    const position = cached ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    if (!position) return STOCKHOLM;
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return STOCKHOLM;
  }
}

async function fetchWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,weather_code,precipitation,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load the weather');

  const data = await response.json() as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      precipitation?: number;
      is_day?: number;
    };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };
  const temperatureC = Math.round(data.current?.temperature_2m ?? 0);
  const highC = Math.round(data.daily?.temperature_2m_max?.[0] ?? temperatureC);
  const lowC = Math.round(data.daily?.temperature_2m_min?.[0] ?? temperatureC);
  const code = data.current?.weather_code ?? 0;
  const isDay = data.current?.is_day !== 0;
  const mapped = mapWeatherCode(code, data.current?.precipitation ?? 0, temperatureC, isDay);
  const placeName = await reverseGeocode(latitude, longitude);

  return {
    temperatureC,
    highC,
    lowC,
    placeName,
    ...mapped,
    isDay,
    summary: `${temperatureC}° ${mapped.label}`,
  };
}

async function reverseGeocode(latitude: number, longitude: number) {
  const nearStockholm =
    Math.abs(latitude - STOCKHOLM.latitude) < 0.02 &&
    Math.abs(longitude - STOCKHOLM.longitude) < 0.02;
  if (nearStockholm) return 'Stockholm';

  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!response.ok) return 'Your location';
    const data = await response.json() as { city?: string; locality?: string };
    return data.city || data.locality || 'Your location';
  } catch {
    return 'Your location';
  }
}

function mapWeatherCode(
  code: number,
  precipitation: number,
  temperatureC: number,
  isDay: boolean,
) {
  const isRainy = precipitation > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const isCold = temperatureC < 12;
  const isWarm = temperatureC >= 20;
  const kind = weatherKind(code, isRainy);

  if (kind === 'storm') {
    return { label: 'thunderstorms', icon: 'thunderstorm' as const, isRainy: true, isCold, isWarm, gradient: gradientFor('storm', isDay) };
  }
  if (kind === 'snow') {
    return { label: 'snow', icon: 'snow' as const, isRainy: true, isCold: true, isWarm: false, gradient: gradientFor('snow', isDay) };
  }
  if (kind === 'rain') {
    return { label: 'rain', icon: 'rainy' as const, isRainy: true, isCold, isWarm, gradient: gradientFor('rain', isDay) };
  }
  if (code === 2) {
    return { label: 'partly cloudy', icon: 'partly-sunny' as const, isRainy: false, isCold, isWarm, gradient: gradientFor('partly', isDay) };
  }
  if (kind === 'cloudy') {
    return { label: 'cloudy', icon: 'cloudy' as const, isRainy: false, isCold, isWarm, gradient: gradientFor('cloudy', isDay) };
  }
  return { label: 'clear skies', icon: 'sunny' as const, isRainy: false, isCold, isWarm, gradient: gradientFor('clear', isDay) };
}

function weatherKind(code: number, isRainy: boolean) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (isRainy) return 'rain';
  if (code >= 3) return 'cloudy';
  return 'clear';
}

function gradientFor(kind: string, isDay: boolean): [string, string] {
  if (!isDay) return ['#2C2426', '#4A3538'];
  switch (kind) {
    case 'rain':
      return ['#7A6568', '#4A3538'];
    case 'storm':
      return ['#4A3538', '#161214'];
    case 'snow':
      return ['#B0A0A3', '#EDE4E5'];
    case 'cloudy':
      return ['#9A8E90', '#D4A0A8'];
    case 'partly':
      return ['#7A6568', '#D4A0A8'];
    default:
      return ['#4A3538', '#D4A0A8'];
  }
}
