import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CORAL = '#1b4654';

function TabIcon({ name, color, size, focused }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={focused ? name.replace('-outline', '') : name} size={size} color={color} />
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
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="mycard"
        options={{
          title: 'My Card',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'card' : 'card-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'qr-code' : 'qr-code-outline'} color={color} size={size + 4} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ainotetaker"
        options={{
          title: 'AI Note',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'mic' : 'mic-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} color={color} size={size} focused={focused} />
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
    borderTopColor: '#F1F5F9',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 95 : 85,
    paddingBottom: Platform.OS === 'ios' ? 35 : 24,
    paddingTop: 12,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  tabLabel: { 
    fontSize: 12, 
    fontWeight: '700',
    marginTop: 6,
  },
  iconWrap: { 
    alignItems: 'center', 
    justifyContent: 'center',
    height: 30,
    width: 30,
  },
});
