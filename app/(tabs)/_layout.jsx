import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CORAL = '#1b4654';

function TabIcon({ name, color, size, focused }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={size - 2} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: CORAL,
        tabBarInactiveTintColor: '#AAAAAA',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="mycard"
        options={{
          title: 'My Card',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "card" : "card-outline"} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "qr-code" : "qr-code-outline"} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ainotetaker"
        options={{
          title: 'AI Note',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "mic" : "mic-outline"} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "people" : "people-outline"} color={color} size={size} focused={focused} />
          ),
        }}
      />
      {/* Hidden legacy screens */}
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#F0F0F0',
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: {},
});
