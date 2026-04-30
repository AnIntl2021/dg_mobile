import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator, Image } from 'react-native';

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <View style={{ 
          width: 120, 
          height: 120, 
          borderRadius: 20, 
          overflow: 'hidden', 
          marginBottom: 20,
          backgroundColor: '#f5f5f5',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Image 
            source={require('../assets/logo.png')} 
            style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
          />
        </View>
        <ActivityIndicator color="#1b6545" size="large" />
      </View>
    );
  }

  return token ? <Redirect href="/(tabs)/mycard" /> : <Redirect href="/(auth)/login" />;
}
