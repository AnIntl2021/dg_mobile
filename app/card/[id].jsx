import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { cardsApi } from '@/services/api';
import { API_BASE_URL } from '@/services/api';

export default function CardDetailScreen() {
  const { id, edit } = useLocalSearchParams();
  const router = useRouter();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  const isNew = id === 'new';
  const cardUrl = `${API_BASE_URL}/c/${id}`;

  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    cardsApi.getOne(id)
      .then(({ data }) => setCard(data))
      .catch(() => Alert.alert('Error', 'Could not load card.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleShare = async () => {
    try {
      await Share.share({ message: cardUrl, url: cardUrl });
    } catch {
      Alert.alert('Error', 'Could not share card.');
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#818cf8" />;

  if (isNew || edit === 'true') {
    // Redirect to edit form
    router.replace(`/card/edit/${id === 'new' ? 'new' : id}`);
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {card ? (
        <>
          <Text style={styles.name}>{card.name}</Text>
          {card.title || card.jobTitle ? (
            <Text style={styles.jobTitle}>{card.title ?? card.jobTitle}</Text>
          ) : null}
          {card.company ? <Text style={styles.company}>{card.company}</Text> : null}

          <View style={styles.qrContainer}>
            <QRCode value={cardUrl} size={200} color="#f8fafc" backgroundColor="#1e293b" />
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Share Card</Text>
          </TouchableOpacity>

          <View style={styles.details}>
            {card.email ? <Detail label="Email" value={card.email} /> : null}
            {card.phone ? <Detail label="Phone" value={card.phone} /> : null}
            {card.website ? <Detail label="Website" value={card.website} /> : null}
            {card.linkedin ? <Detail label="LinkedIn" value={card.linkedin} /> : null}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>Card not found.</Text>
      )}
    </ScrollView>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loader: { flex: 1 },
  content: { padding: 24, paddingTop: 60, alignItems: 'center' },
  back: { alignSelf: 'flex-start', marginBottom: 24 },
  backText: { color: '#818cf8', fontSize: 15 },
  name: { fontSize: 28, fontWeight: '700', color: '#f8fafc', textAlign: 'center' },
  jobTitle: { fontSize: 16, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  company: { fontSize: 14, color: '#64748b', marginTop: 2, textAlign: 'center' },
  qrContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    marginVertical: 32,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shareBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 32,
  },
  shareBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  details: { width: '100%', gap: 8 },
  detailRow: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailLabel: { color: '#64748b', fontSize: 14 },
  detailValue: { color: '#f8fafc', fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  empty: { color: '#64748b', fontSize: 16, marginTop: 60 },
});
