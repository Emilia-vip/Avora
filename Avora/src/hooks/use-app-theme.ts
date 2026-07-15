import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export function useAppTheme() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
