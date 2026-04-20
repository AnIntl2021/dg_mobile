import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#1b6545" size="large" />
      </View>
    );
  }

  return token ? <Redirect href="/(tabs)/mycard" /> : <Redirect href="/(auth)/login" />;
}
