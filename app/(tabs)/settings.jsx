import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.item}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{user?.name ?? '—'}</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? '—'}</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{user?.role ?? '—'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 32 },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  sectionTitle: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  label: { color: '#94a3b8', fontSize: 15 },
  value: { color: '#f8fafc', fontSize: 15, fontWeight: '500' },
  logoutBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: { color: '#fca5a5', fontWeight: '700', fontSize: 16 },
});
