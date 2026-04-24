import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { leadsApi, cardsApi } from '@/services/api';

const CORAL = '#1b4654';

const AVATAR_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#F44336', '#00BCD4', '#FF5722', '#607D8B',
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 2 * 86400000) return 'Yesterday';
  return `${Math.floor(diff / 86400000)} days ago`;
}

export default function ContactsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState([]);
  const [cardName, setCardName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  const fetchContacts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch card name for header display
      if (!cardName) {
        try {
          let cardData;
          if (user?.role === 'card_user') {
            const { data } = await cardsApi.getMyCard();
            cardData = data.card || data;
          } else {
            const { data } = await cardsApi.getAll();
            const list = Array.isArray(data) ? data : data?.cards ?? [];
            cardData = list[0] ?? null;
          }
          if (cardData?.name) setCardName(cardData.name);
        } catch {}
      }

      // GET /cards/leads — backend already filters by card_user's card_id from JWT token
      const { data } = await leadsApi.getAll();
      const list = Array.isArray(data) ? data : data?.leads ?? [];
      setContacts(list);
    } catch {
      // keep empty list silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, cardName]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleShare = async (contact) => {
    const text = [contact.visitor_name, contact.email, contact.phone].filter(Boolean).join('\n');
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.visitor_name ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CORAL} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Contacts</Text>
          {cardName ? (
            <Text style={styles.headerSub} numberOfLines={1}>{cardName}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={CORAL} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id ?? item.email ?? Math.random())}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchContacts(true); }}
              tintColor={CORAL}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={56} color="#DDD" />
              <Text style={styles.emptyText}>No contacts yet</Text>
              <Text style={styles.emptySub}>
                People who scan or receive your card will appear here
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            // Backend fields: visitor_name, email, phone, action_type, created_at
            const name = item.visitor_name || 'Unknown';

            return (
              <View style={styles.contactRow}>
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: getAvatarColor(name) }]}>
                  <Text style={styles.avatarText}>{getInitials(name)}</Text>
                </View>

                {/* Info */}
                <View style={styles.info}>
                  <Text style={styles.name}>{name}</Text>
                  {item.email ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="mail-outline" size={12} color="#888" style={styles.metaIcon} />
                      <Text style={styles.metaText} numberOfLines={1}>{item.email}</Text>
                    </View>
                  ) : null}
                  {item.phone ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={12} color="#888" style={styles.metaIcon} />
                      <Text style={styles.metaText}>{item.phone}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Right: time + share */}
                <View style={styles.right}>
                  <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
                  <TouchableOpacity onPress={() => handleShare(item)}>
                    <Ionicons name="share-social-outline" size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 20,
    backgroundColor: CORAL,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1E293B' },
  list: { paddingBottom: 120 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaIcon: { marginRight: 4 },
  metaText: { fontSize: 12, color: '#888', flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 12, color: '#AAAAAA' },
  separator: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 78 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#AAAAAA' },
  emptySub: { fontSize: 13, color: '#CCCCCC', textAlign: 'center', lineHeight: 20 },
});