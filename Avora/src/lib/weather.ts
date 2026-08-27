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

function getCoordinates() {
  return new Promise<{ latitude: number; longitude: number }>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(STOCKHOLM);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(STOCKHOLM),
      { timeout: 4000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

async function fetchWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,weather_code,precipitation,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Kunde inte hämta väder');

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
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=sv`,
    );
    if (!response.ok) return 'Din plats';
    const data = await response.json() as { city?: string; locality?: string };
    return data.city || data.locality || 'Din plats';
  } catch {
    return 'Din plats';
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
    return { label: 'åska', icon: 'thunderstorm' as const, isRainy: true, isCold, isWarm, gradient: gradientFor('storm', isDay) };
  }
  if (kind === 'snow') {
    return { label: 'snö', icon: 'snow' as const, isRainy: true, isCold: true, isWarm: false, gradient: gradientFor('snow', isDay) };
  }
  if (kind === 'rain') {
    return { label: 'regn', icon: 'rainy' as const, isRainy: true, isCold, isWarm, gradient: gradientFor('rain', isDay) };
  }
  if (code === 2) {
    return { label: 'växlande molnighet', icon: 'partly-sunny' as const, isRainy: false, isCold, isWarm, gradient: gradientFor('partly', isDay) };
  }
  if (kind === 'cloudy') {
    return { label: 'mulet', icon: 'cloudy' as const, isRainy: false, isCold, isWarm, gradient: gradientFor('cloudy', isDay) };
  }
  return { label: 'klart', icon: 'sunny' as const, isRainy: false, isCold, isWarm, gradient: gradientFor('clear', isDay) };
}

function weatherKind(code: number, isRainy: boolean) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (isRainy) return 'rain';
  if (code >= 3) return 'cloudy';
  return 'clear';
}

function gradientFor(kind: string, isDay: boolean): [string, string] {
  if (!isDay) return ['#1A1520', '#3D322B'];
  switch (kind) {
    case 'rain':
      return ['#5A534C', '#3D322B'];
    case 'storm':
      return ['#2C2420', '#1A1520'];
    case 'snow':
      return ['#A39A92', '#E5DDD4'];
    case 'cloudy':
      return ['#7A726A', '#C4A574'];
    case 'partly':
      return ['#6F6258', '#C4A574'];
    default:
      return ['#3D322B', '#C4A574'];
  }
}
