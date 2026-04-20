import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { cardsApi } from '@/services/api';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ cards: 0, leads: 0, views: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cardsApi.getAll()
      .then(({ data }) => setStats((s) => ({ ...s, cards: data.length })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Hello, {user?.name ?? 'there'} 👋</Text>
      <Text style={styles.sub}>Here's your overview</Text>

      {loading ? (
        <ActivityIndicator color="#818cf8" style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.statsRow}>
          {[
            { label: 'Cards', value: stats.cards, route: '/(tabs)/cards' },
            { label: 'Leads', value: stats.leads, route: '/(tabs)/leads' },
            { label: 'Views', value: stats.views, route: null },
          ].map(({ label, value, route }) => (
            <TouchableOpacity
              key={label}
              style={styles.statCard}
              onPress={() => route && router.push(route)}
              disabled={!route}
            >
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/cards')}>
        <Text style={styles.ctaText}>+ Create New Card</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  sub: { fontSize: 14, color: '#94a3b8', marginBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: { fontSize: 28, fontWeight: '700', color: '#818cf8' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  cta: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
