import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIconButton } from '@/components/navigation/tab-icon-button';
import { TabPlusButton } from '@/components/navigation/tab-plus-button';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function TabLayout() {
  const colors = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        // Floating pill that hovers above the content instead of a full-width bar.
        tabBarStyle: {
          position: 'absolute',
          bottom: Math.max(insets.bottom, 12),
          marginHorizontal: 20,
          height: 64,
          paddingTop: 0,
          paddingBottom: 0,
          borderRadius: 32,
          borderTopWidth: 0,
          backgroundColor: colors.tabBar,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 10,
        },
        tabBarItemStyle: {
          height: 64,
        },
        tabBarButton: (props) => <TabIconButton {...props} />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Wardrobe',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'shirt' : 'shirt-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => <TabPlusButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="outfits"
        options={{
          title: 'Looks',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
