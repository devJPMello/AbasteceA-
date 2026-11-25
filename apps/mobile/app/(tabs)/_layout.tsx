import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/theme';

const icon = (glyph: string) => () => <Text style={{ fontSize: 18 }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: '#fff',
        tabBarActiveTintColor: colors.brand,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Mapa', tabBarIcon: icon('🗺️') }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alertas', tabBarIcon: icon('🔔') }} />
      <Tabs.Screen name="account" options={{ title: 'Conta', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
