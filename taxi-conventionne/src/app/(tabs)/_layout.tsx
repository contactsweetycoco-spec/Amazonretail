import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';

import { colors } from '../../lib/theme';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen name="carte" options={{ title: 'Carte', tabBarIcon: icon('🗺️') }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses dispo', tabBarIcon: icon('🚕') }} />
      <Tabs.Screen name="mes-courses" options={{ title: 'Mes courses', tabBarIcon: icon('📋') }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
