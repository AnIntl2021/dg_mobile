import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  SafeAreaView,
  Alert,
  Image,
  Linking,
  Modal,
  StatusBar,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { cardsApi, API_BASE_URL, FRONTEND_BASE_URL } from '@/services/api';

const BRAND = '#1b4654';
const SCREEN_WIDTH = Dimensions.get('window').width;

/* ─── Sidebar Drawer ─── */
function SidebarDrawer({ visible, onClose, user, onLogout, avatarUrl }) {
  const insets = useSafeAreaInsets();
  const translateX = useState(new Animated.Value(-SCREEN_WIDTH * 0.75))[0];

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -SCREEN_WIDTH * 0.75,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const initials = (user?.name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={sd.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Drawer panel */}
      <Animated.View style={[sd.panel, { transform: [{ translateX }] }]}>
        <View style={{ flex: 1 }}>
          {/* Profile section */}
          <View style={[sd.profileSection, { paddingTop: (insets.top || 0) + 20 }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={sd.avatar} />
            ) : (
              <View style={[sd.avatar, sd.avatarFallback]}>
                <Text style={sd.avatarInitial}>{initials}</Text>
              </View>
            )}
            <Text style={sd.name} numberOfLines={1}>{user?.name || 'User'}</Text>
            <Text style={sd.email} numberOfLines={1}>{user?.email || ''}</Text>
          </View>

          {/* Divider */}
          <View style={sd.divider} />

          {/* Menu items */}
          <View style={sd.menu}>
            <TouchableOpacity style={sd.menuItem} onPress={onClose}>
              <View style={[sd.menuIcon, { backgroundColor: '#EDF5F3' }]}>
                <Text style={{ fontSize: 16 }}>💳</Text>
              </View>
              <Text style={sd.menuLabel}>My Card</Text>
            </TouchableOpacity>
          </View>

          {/* Sign out at bottom */}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[sd.signOutBtn, { marginBottom: (insets.bottom || 0) + 20 }]} onPress={onLogout}>
            <Text style={sd.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const resolveUrl = (val) => {
  if (!val) return null;
  if (val.startsWith('data:')) return val;
  const base = API_BASE_URL.replace(/\/api$/, '');
  // Handle localhost URLs saved by the frontend editor — swap host to the backend IP
  if (val.includes('localhost') || val.includes('127.0.0.1')) {
    const match = val.match(/\/uploads\/.+/);
    if (match) return `${base}${match[0]}`;
    return null;
  }
  if (val.startsWith('http')) return val;
  return `${base}${val}`;
};

const parseDesign = (card) => {
  const raw = card?.design ?? card?.design_config ?? {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw || {};
};

const parseDigCardPath = (value) => {
  if (!value) return null;
  const text = String(value);

  const cardMatch = text.match(/\/card\/([^/]+)\/([^/?#]+)/);
  if (cardMatch) return { tenantSlug: cardMatch[1], cardSlug: cardMatch[2] };

  const cMatch = text.match(/\/c\/([^/]+)\/([^/?#]+)/);
  if (cMatch) return { tenantSlug: cMatch[1], cardSlug: cMatch[2] };

  return null;
};

const buildCardShareText = ({ card, design, cardUrl, displayName }) => {
  const lines = [displayName || card?.name || 'DigCard'];
  const jobTitle = design?.jobTitle || design?.title || card?.title || '';

  if (jobTitle) lines.push(jobTitle);
  if (card?.company) lines.push(card.company);
  if (card?.phone) lines.push(`Phone: ${card.phone}`);
  if (card?.email) lines.push(`Email: ${card.email}`);
  if (card?.website) lines.push(`Website: ${card.website}`);
  lines.push('');
  lines.push(cardUrl);

  return lines.join('\n');
};

/* ─── Contact row on card ─── */
function ContactRow({ icon, value, label, accentColor, onPress, textColor = '#111827', borderColor = '#F1F5F9' }) {
  if (!value) return null;
  return (
    <TouchableOpacity
      style={[s.contactRow, { borderBottomColor: borderColor }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[s.contactIcon, { backgroundColor: accentColor || BRAND }]}>
        <Ionicons name={icon} size={17} color="#fff" />
      </View>
      <View style={s.contactTextWrap}>
        <Text style={[s.contactValue, { color: textColor }]} numberOfLines={2}>{value}</Text>
        {label ? <Text style={[s.contactLabel, { color: textColor, opacity: 0.5 }]}>{label}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/* ─── Share option row ─── */
function ShareRow({ icon, label, onPress, isLast, customIcon }) {
  return (
    <TouchableOpacity
      style={[sh.row, !isLast && sh.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={sh.rowIconWrap}>
        {customIcon || <Ionicons name={icon} size={22} color="#fff" />}
      </View>
      <Text style={sh.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />
    </TouchableOpacity>
  );
}

/* ═══════════════ Sub-screen: Email Your Card ═══════════════ */
function EmailScreen({ onBack, cardUrl, displayName }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('Hi, tap this link to get my business card:');

  const send = () => {
    if (!to.trim()) { Alert.alert('Required', 'Enter a recipient email address.'); return; }
    const body = `${message}\n\n${cardUrl}`;
    Linking.openURL(
      `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(
        `${displayName}'s Digital Card`
      )}&body=${encodeURIComponent(body)}`
    );
  };

  return (
    <KeyboardAvoidingView
      style={sub.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <View style={sub.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={sub.headerTitle}>Email Your Card</Text>
        <TouchableOpacity onPress={send} hitSlop={12}>
          <Text style={sub.headerAction}>SEND</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Email your DG card to...</Text>
          <View style={sub.inputRow}>
            <TextInput
              style={sub.input}
              placeholder="recipient@email.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={to}
              onChangeText={setTo}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={sub.contactsBtn}>
              <Ionicons name="person-outline" size={20} color="#fff" />
              <Text style={sub.contactsBtnText}>Contacts</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={sub.card}>
          <Text style={sub.cardLabel}>Edit your message...</Text>
          <TextInput
            style={[sub.input, { minHeight: 60 }]}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
        </View>

        <TouchableOpacity style={sub.sendBtn} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: 8 }} />
          <Text style={sub.sendBtnText}>SEND EMAIL</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════ Sub-screen: Text Your Card ═══════════════ */
function TextScreen({ onBack, cardUrl, displayName }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Hi, tap this link to get my business card:');

  const send = () => {
    const body = `${message}\n${cardUrl}`;
    const num = phone.trim();
    Linking.openURL(
      num
        ? `sms:${encodeURIComponent(num)}?body=${encodeURIComponent(body)}`
        : `sms:?body=${encodeURIComponent(body)}`
    );
  };

  return (
    <KeyboardAvoidingView
      style={sub.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <View style={sub.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={sub.headerTitle}>Text Your Card</Text>
        <TouchableOpacity onPress={send} hitSlop={12}>
          <Text style={sub.headerAction}>SEND</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Text your DG card to...</Text>
          <View style={sub.inputRow}>
            <TextInput
              style={sub.input}
              placeholder="Phone number"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={sub.contactsBtn}>
              <Ionicons name="person-outline" size={20} color="#fff" />
              <Text style={sub.contactsBtnText}>Contacts</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={sub.card}>
          <Text style={sub.cardLabel}>Edit your message...</Text>
          <TextInput
            style={[sub.input, { minHeight: 60 }]}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
        </View>

        <TouchableOpacity style={sub.sendBtn} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: 8 }} />
          <Text style={sub.sendBtnText}>SEND TEXT</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════ Sub-screen: Send via WhatsApp ═══════════════ */
function WhatsAppScreen({ onBack, cardUrl, displayName }) {
  const [countryCode, setCountryCode] = useState('+965');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Hi, tap this link to get my business card:');

  const send = () => {
    const body = `${message}\n${cardUrl}`;
    const num = `${countryCode}${phone}`.replace(/[^+\d]/g, '');
    if (num.length > 4) {
      Linking.openURL(`https://wa.me/${num.replace('+', '')}?text=${encodeURIComponent(body)}`);
    } else {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(body)}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={sub.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <View style={sub.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={sub.headerTitle}>Send via WhatsApp</Text>
        <TouchableOpacity onPress={send} hitSlop={12}>
          <Text style={sub.headerAction}>SEND</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={sub.card}>
          <Text style={sub.cardLabel}>WhatsApp your DG card to...</Text>
          <View style={sub.inputRow}>
            <TextInput
              style={sub.codeInput}
              value={countryCode}
              onChangeText={setCountryCode}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[sub.input, { flex: 1 }]}
              placeholder="Phone number"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={sub.contactsBtn}>
              <Ionicons name="person-outline" size={20} color="#fff" />
              <Text style={sub.contactsBtnText}>Contacts</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={sub.card}>
          <Text style={sub.cardLabel}>Edit your message...</Text>
          <TextInput
            style={[sub.input, { minHeight: 60 }]}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
        </View>

        <TouchableOpacity style={sub.sendBtn} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: 8 }} />
          <Text style={sub.sendBtnText}>SEND MESSAGE</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════ Sub-screen: Send via LinkedIn ═══════════════ */
function LinkedInScreen({ onBack, cardUrl, displayName }) {
  const [message, setMessage] = useState('Hi, tap this link to get my business card:');

  const sendMessage = () => {
    const body = `${message}\n${cardUrl}`;
    Linking.openURL(
      `https://www.linkedin.com/messaging/compose/?body=${encodeURIComponent(body)}`
    );
  };

  const postToFeed = () => {
    Linking.openURL(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cardUrl)}`
    );
  };

  return (
    <KeyboardAvoidingView
      style={sub.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <View style={sub.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={sub.headerTitle}>Send via LinkedIn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Edit your message...</Text>
          <TextInput
            style={[sub.input, { minHeight: 60 }]}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
        </View>

        <TouchableOpacity style={sub.sendBtn} onPress={sendMessage} activeOpacity={0.85}>
          <View style={[sh.brandBadge, { backgroundColor: '#0A66C2', marginRight: 8 }]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>in</Text>
          </View>
          <Text style={sub.sendBtnText}>SEND MESSAGE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sub.sendBtn, { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={postToFeed}
          activeOpacity={0.85}
        >
          <Ionicons name="globe-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={[sub.sendBtnText, { color: '#fff' }]}>POST TO FEED</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════ Share Modal ═══════════════════════ */
function ShareModal({ visible, onClose, cardUrl, displayName, cardId, cardSlug, tenantSlug, shareText }) {
  const [offline, setOffline] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [subScreen, setSubScreen] = useState(null);
  const qrSvgRef = useRef(null);

  const shareMsg = shareText || `Check out my digital business card: ${cardUrl}`;

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(cardUrl);
      Alert.alert('Copied!', 'Card link copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy link.');
    }
  };

  const sendOther = async () => {
    try { await Share.share({ message: shareMsg, url: cardUrl }); } catch {}
  };

  const postFacebook = () =>
    Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cardUrl)}`);

  const saveQRToPhotos = async () => {
    if (!qrSvgRef.current || typeof qrSvgRef.current.toDataURL !== 'function') {
      Alert.alert('Error', 'QR code is not ready yet. Please try again.');
      return;
    }

    try {
      const base64 = await new Promise((resolve, reject) => {
        try {
          qrSvgRef.current.toDataURL((data) => {
            if (data) resolve(data);
            else reject(new Error('Empty QR image data'));
          });
        } catch (e) {
          reject(e);
        }
      });

      const uri = `${FileSystem.cacheDirectory}qrcode_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(uri);
        const albumName = 'DigCard';
        const album = await MediaLibrary.getAlbumAsync(albumName);
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync(albumName, asset, false);
        }
        Alert.alert('Saved', 'QR code saved to your photos.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share QR Code',
        });
        Alert.alert('Permission needed', 'Storage permission was denied, so the QR was shared instead.');
      } else {
        Alert.alert('Error', 'Storage permission denied and sharing is unavailable on this device.');
      }
    } catch (err) {
      const msg = err?.message || 'Could not save QR code image.';
      Alert.alert('Error', msg);
    }
  };

  const sendQR = async () => {
    try { await Share.share({ message: `${shareMsg}\n\nScan the QR or open the link.`, url: cardUrl }); } catch {}
  };

  const addToWallet = async () => {
    if ((!tenantSlug || !cardSlug) && !cardId) { Alert.alert('Unavailable', 'Card info not found.'); return; }
    setWalletLoading(true);
    try {
      let walletUrl = null;

      if (tenantSlug && cardSlug) {
        try {
          const { data } = await cardsApi.getPublicWalletPass(tenantSlug, cardSlug);
          walletUrl = data?.walletUrl || null;
        } catch (publicErr) {
          if (!(publicErr?.response?.status === 404 && cardId)) {
            throw publicErr;
          }
        }
      }

      if (!walletUrl && cardId) {
        const { data } = await cardsApi.getWalletPass(cardId);
        walletUrl = data?.walletUrl || null;
      }

      if (walletUrl) {
        await Linking.openURL(walletUrl);
      } else {
        Alert.alert('Error', 'Could not generate wallet pass.');
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to add card to wallet.';
      Alert.alert('Error', msg);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleClose = () => {
    setSubScreen(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={sh.safe}>
        {/* Sub-screens */}
        {subScreen === 'email' && (
          <EmailScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} displayName={displayName} />
        )}
        {subScreen === 'text' && (
          <TextScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} displayName={displayName} />
        )}
        {subScreen === 'whatsapp' && (
          <WhatsAppScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} displayName={displayName} />
        )}
        {subScreen === 'linkedin' && (
          <LinkedInScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} displayName={displayName} />
        )}

        {/* Main share list */}
        {!subScreen && (
          <>
            <StatusBar barStyle="light-content" backgroundColor={BRAND} />

            <View style={sh.header}>
              <TouchableOpacity onPress={handleClose} hitSlop={12} style={sh.headerBtn}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={sh.headerTitle}>Send Your Card</Text>
              <TouchableOpacity hitSlop={12} style={sh.headerBtn}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={sh.scroll} showsVerticalScrollIndicator={false}>
              {/* QR code */}
              {cardUrl ? (
                <View style={sh.qrWrap}>
                  <View style={sh.qrBox}>
                    <QRCode
                      value={cardUrl}
                      size={210}
                      color="#111"
                      backgroundColor="#fff"
                      getRef={r => { qrSvgRef.current = r; }}
                    />
                  </View>
                  <Text style={sh.qrText}>
                    Point your camera at the QR{'\n'}code to receive the card
                  </Text>
                </View>
              ) : null}

              {/* Offline toggle */}
              <View style={sh.group}>
                <View style={sh.toggleRow}>
                  <View style={sh.rowIconWrap}>
                    <Ionicons name="wifi-outline" size={20} color="rgba(255,255,255,0.55)" />
                  </View>
                  <Text style={[sh.rowLabel, { flex: 1 }]}>Share card offline</Text>
                  <Switch
                    value={offline}
                    onValueChange={setOffline}
                    trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(255,255,255,0.55)' }}
                    thumbColor="#fff"
                    ios_backgroundColor="rgba(255,255,255,0.2)"
                  />
                </View>
              </View>

              {/* Copy link */}
              <View style={sh.group}>
                <ShareRow icon="copy-outline" label="Copy link" onPress={copyLink} isLast />
              </View>

              {/* Send group */}
              <View style={sh.group}>
                <ShareRow icon="chatbubble-outline" label="Text your card" onPress={() => setSubScreen('text')} />
                <ShareRow icon="mail-outline" label="Email your card" onPress={() => setSubScreen('email')} />
                <ShareRow
                  label="Send via WhatsApp"
                  onPress={() => setSubScreen('whatsapp')}
                  customIcon={
                    <View style={[sh.brandBadge, { backgroundColor: '#25D366' }]}>
                      <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    </View>
                  }
                />
                <ShareRow
                  label="Send via LinkedIn"
                  onPress={() => setSubScreen('linkedin')}
                  customIcon={
                    <View style={[sh.brandBadge, { backgroundColor: '#0A66C2' }]}>
                      <Text style={sh.liText}>in</Text>
                    </View>
                  }
                />
                <ShareRow icon="ellipsis-horizontal" label="Send another way" onPress={sendOther} isLast />
              </View>

              {/* Post group */}
              <View style={sh.group}>
                <ShareRow
                  label="Post to LinkedIn"
                  onPress={() =>
                    Linking.openURL(
                      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cardUrl)}`
                    )
                  }
                  customIcon={
                    <View style={[sh.brandBadge, { backgroundColor: '#0A66C2' }]}>
                      <Text style={sh.liText}>in</Text>
                    </View>
                  }
                />
                <ShareRow
                  label="Post to Facebook"
                  onPress={postFacebook}
                  isLast
                  customIcon={
                    <View style={[sh.brandBadge, { backgroundColor: '#1877F2' }]}>
                      <Ionicons name="logo-facebook" size={17} color="#fff" />
                    </View>
                  }
                />
              </View>

              {/* QR group */}
              <View style={sh.group}>
                <ShareRow
                  label="Save QR code to photos"
                  onPress={saveQRToPhotos}
                  customIcon={
                    <View style={[sh.brandBadge, { backgroundColor: 'transparent', padding: 0 }]}>
                      <Text style={{ fontSize: 22 }}>🖼️</Text>
                    </View>
                  }
                />
                <ShareRow icon="paper-plane-outline" label="Send QR code" onPress={sendQR} isLast />
              </View>

              {/* Wallet */}
              <View style={sh.group}>
                <TouchableOpacity
                  style={sh.row}
                  onPress={addToWallet}
                  activeOpacity={0.7}
                  disabled={walletLoading}
                >
                  <View style={sh.rowIconWrap}>
                    {walletLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="wallet-outline" size={22} color="#fff" />}
                  </View>
                  <Text style={[sh.rowLabel, { flex: 1 }]}>
                    {walletLoading ? 'Opening wallet\u2026' : 'Add card to wallet'}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/* ═══════════════════════════════ Main Screen ═══════════════════════════════ */
export default function MyCardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const fetchCard = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.role === 'card_user') {
        const { data } = await cardsApi.getMyCard();
        setCard(data.card || data);
      } else {
        const { data } = await cardsApi.getAll();
        const cards = Array.isArray(data) ? data : data?.cards ?? [];
        if (cards.length > 0) setCard(cards[0]);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ActivityIndicator style={{ flex: 1 }} color={BRAND} />
      </SafeAreaView>
    );
  }

  const design = parseDesign(card);
  const accentColor = design.accentColor || BRAND;
  const templateId = design.selectedTemplateId || design.cardStyle || '';
  const cardBgColor = design.bgColor || '#ffffff';
  const cardTextColor = design.textColor || '#111827';
  const isDark = !['#ffffff', '#f8fafc', '#fff', 'white'].includes((cardBgColor || '').toLowerCase());
  const rowBorderColor = isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9';
  const subTextColor = isDark ? 'rgba(255,255,255,0.6)' : '#64748B';
  const displayName = card?.name || user?.name || 'Your Name';
  const jobTitle = design.jobTitle || design.title || card?.title || '';
  const company = card?.company || '';
  const department = card?.department || '';
  const bio = card?.bio || card?.headline || '';
  const socialLinks = (() => {
    let sl = card?.social_links || [];
    if (typeof sl === 'string') try { sl = JSON.parse(sl); } catch { sl = []; }
    return Array.isArray(sl) ? sl.filter(l => l?.url) : [];
  })();

  const avatarUrl = resolveUrl(card?.profile_image);
  const coverUrl = resolveUrl(design.coverImage);
  const companyLogoUrl = resolveUrl(design.companyLogoImage);
  const showLogo = design.showCompanyLogo !== false && !!companyLogoUrl && !logoError;

  const parsedCardPath = parseDigCardPath(card?.card_url);
  const tenantSlug =
    user?.tenant_slug ||
    user?.schema_slug ||
    user?.schemaSlug ||
    card?.tenant_slug ||
    card?.schema_slug ||
    parsedCardPath?.tenantSlug ||
    '';
  const cardSlug = card?.slug || parsedCardPath?.cardSlug || '';
  const cardUrl = cardSlug && tenantSlug
    ? `${FRONTEND_BASE_URL}/#/card/${tenantSlug}/${cardSlug}`
    : card?.card_url
      ? `${FRONTEND_BASE_URL}/#${String(card.card_url).replace(/^#?\/?/, '')}`
      : '';
  const shareText = buildCardShareText({ card, design, cardUrl, displayName });

  return (
    <View style={{ flex: 1, backgroundColor: BRAND }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent={false} />
      {/* Header — paddingTop uses safe area inset which works on both iOS and Android */}
      <View style={[s.topBar, { paddingTop: (insets.top || 0) + 12 }]}>
          <TouchableOpacity onPress={() => setSidebarOpen(true)} hitSlop={10} style={s.menuBtn}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.menuAvatar} />
            ) : (
              <View style={s.menuAvatarFallback}>
                <Text style={s.menuAvatarText}>
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={s.topTitle}>Ansoftt DG</Text>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} hitSlop={10}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

      {/* Content area */}
      <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={[s.card, { backgroundColor: cardBgColor }]}>

              {/* ── Header / cover (112px, matches web h-28) ── */}
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={s.cover} />
              ) : templateId === 'minimal-pro' ? (
                <View style={[s.cardHeader, { backgroundColor: cardBgColor }]}>
                  <View style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: '#e8503a' }} />
                  <View style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: 32.5, backgroundColor: accentColor }} />
                </View>
              ) : templateId === 'ocean-gradient' ? (
                <View style={[s.cardHeader, { backgroundColor: cardBgColor }]}>
                  <View style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: accentColor }} />
                  <View style={{ position: 'absolute', top: 2, right: 22, width: 48, height: 48, borderRadius: 24, backgroundColor: '#2abfaa' }} />
                </View>
              ) : templateId === 'aurora-glass' ? (
                <View style={[s.cardHeader, { backgroundColor: cardBgColor }]}>
                  <View style={{ position: 'absolute', top: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(131,58,180,0.38)' }} />
                  <View style={{ position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: `${accentColor}55` }} />
                </View>
              ) : (
                /* Default / executive / holographic / neon-circuit */
                <View style={[s.cardHeader, { backgroundColor: accentColor }]}>
                  <View style={{ position: 'absolute', top: -10, right: -10, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <View style={{ position: 'absolute', bottom: -8, left: -8, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                </View>
              )}

              {/* ── Logo (LEFT) + Avatar (RIGHT) — overlap header by 40px ── */}
              <View style={s.avatarRow}>
                {/* Company logo — square/rounded, LEFT */}
                <View style={s.logoWrap}>
                  {showLogo ? (
                    <Image
                      source={{ uri: companyLogoUrl }}
                      style={s.logoImg}
                      resizeMode="contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : company ? (
                    <View style={[s.logoFallback, { backgroundColor: accentColor }]}>
                      <Ionicons name="business-outline" size={20} color="#fff" />
                      <Text style={s.logoFallbackText} numberOfLines={1}>{company.substring(0, 10)}</Text>
                    </View>
                  ) : (
                    <View style={[s.logoFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }]}>
                      <Ionicons name="business-outline" size={26} color={isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8'} />
                    </View>
                  )}
                </View>
                {/* Person profile — circular, RIGHT */}
                <View style={s.avatarWrap}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
                  ) : (
                    <View style={[s.avatarFallback, { backgroundColor: accentColor }]}>
                      <Text style={s.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* ── Info section — matches web layout exactly ── */}
              <View style={s.infoSection}>
                {company ? (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={s.companyLabel}>COMPANY</Text>
                    <Text style={[s.companyAccent, { color: accentColor }]}>{company}</Text>
                  </View>
                ) : null}
                <Text style={[s.cardName, { color: cardTextColor }]}>{displayName}</Text>
                {jobTitle ? <Text style={[s.jobTitle, { color: cardTextColor, opacity: 0.7 }]}>{jobTitle}</Text> : null}
                {company ? <Text style={[s.companyText, { color: cardTextColor, opacity: 0.55 }]}>{company}</Text> : null}
                {department ? <Text style={[s.deptText, { color: subTextColor }]}>{department}</Text> : null}
              </View>

              {bio ? (
                <View style={s.bioSection}>
                  <Text style={[s.bioText, { color: subTextColor }]}>{bio}</Text>
                </View>
              ) : null}

              {/* ── Contact rows ── */}
              <View style={s.contactsSection}>
                <ContactRow icon="mail" value={card?.email} label="Email" accentColor={accentColor} textColor={cardTextColor} borderColor={rowBorderColor}
                  onPress={card?.email ? () => Linking.openURL(`mailto:${card.email}`) : undefined} />
                <ContactRow icon="call" value={card?.phone} label="Phone" accentColor={accentColor} textColor={cardTextColor} borderColor={rowBorderColor}
                  onPress={card?.phone ? () => Linking.openURL(`tel:${card.phone}`) : undefined} />
                <ContactRow icon="globe-outline" value={card?.website} label="Website" accentColor={accentColor} textColor={cardTextColor} borderColor={rowBorderColor}
                  onPress={card?.website ? () => Linking.openURL(card.website.startsWith('http') ? card.website : `https://${card.website}`) : undefined} />
                <ContactRow icon="location-outline" value={card?.address} label="Address" accentColor={accentColor} textColor={cardTextColor} borderColor={rowBorderColor} />
                {socialLinks.map((item) => {
                  const iconName =
                    item.platform === 'linkedin'  ? 'logo-linkedin'
                    : item.platform === 'instagram' ? 'logo-instagram'
                    : item.platform === 'twitter'   ? 'logo-twitter'
                    : item.platform === 'youtube'   ? 'logo-youtube'
                    : item.platform === 'whatsapp'  ? 'logo-whatsapp'
                    : 'link-outline';
                  return (
                    <ContactRow
                      key={item.platform}
                      icon={iconName}
                      value={item.url}
                      label={item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
                      accentColor={accentColor}
                      textColor={cardTextColor}
                      borderColor={rowBorderColor}
                      onPress={() => Linking.openURL(item.url.startsWith('http') ? item.url : `https://${item.url}`)}
                    />
                  );
                })}
              </View>

              {/* ── QR Code row — tap for full overlay ── */}
              {cardUrl ? (
                <TouchableOpacity style={[s.qrToggleRow, { borderTopColor: rowBorderColor }]} onPress={() => setShowQR(true)} activeOpacity={0.7}>
                  <View style={s.qrThumb}>
                    <QRCode value={cardUrl} size={44} color="#111827" backgroundColor="#fff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.qrToggleTitle, { color: cardTextColor }]}>View QR Code</Text>
                    <Text style={[s.qrToggleSub, { color: subTextColor }]}>Tap to show full QR code</Text>
                  </View>
                  <Ionicons name="expand-outline" size={20} color={subTextColor} />
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>

        {/* Share button */}
        <View style={s.footer}>
          <TouchableOpacity style={s.shareBtn} onPress={() => setShareOpen(true)}>
            <Ionicons name="paper-plane-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
            <Text style={s.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* QR Code full-screen overlay */}
      {showQR && cardUrl ? (
        <Modal visible animationType="fade" transparent statusBarTranslucent>
          <TouchableOpacity style={s.qrOverlay} activeOpacity={1} onPress={() => setShowQR(false)}>
            <View style={s.qrOverlayCard}>
              <TouchableOpacity style={s.qrCloseBtn} onPress={() => setShowQR(false)} hitSlop={14}>
                <Ionicons name="close" size={22} color="#555" />
              </TouchableOpacity>
              <QRCode value={cardUrl} size={SCREEN_WIDTH * 0.62} color="#111827" backgroundColor="#fff" />
              <Text style={s.qrPageName}>{displayName}</Text>
              {jobTitle ? <Text style={s.qrPageJob}>{jobTitle}</Text> : null}
              <Text style={s.qrPageHint}>Point a camera at this QR code to view my card</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}

      <ShareModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        cardUrl={cardUrl}
        displayName={displayName}
        cardId={card?.id}
        cardSlug={cardSlug}
        tenantSlug={tenantSlug}
        shareText={shareText}

      />

      <SidebarDrawer
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        avatarUrl={avatarUrl}
        onLogout={() => { setSidebarOpen(false); handleLogout(); }}
      />
    </View>
  );
}

/* ════════════════════════ Card styles ════════════════════════ */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: BRAND,
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  menuBtn: { padding: 2 },
  menuAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  menuAvatarFallback: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  menuAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn: { padding: 4 },
  /* QR toggle row (inside card) */
  qrToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  qrThumb: {
    width: 60,
    height: 60,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  qrToggleTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  qrToggleSub: { fontSize: 12, color: '#94A3B8' },
  /* QR overlay modal */
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  qrOverlayCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  qrCloseBtn: { alignSelf: 'flex-end', marginBottom: 12, padding: 4 },
  qrPageName: { fontSize: 20, fontWeight: '800', color: '#111', marginTop: 20 },
  qrPageJob: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 4 },
  qrPageHint: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12, lineHeight: 18 },
  scroll: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cover: { width: '100%', height: 140 },
  /* 112px header area (matches web h-28 = 7rem) */
  cardHeader: { width: '100%', height: 112, overflow: 'hidden', position: 'relative' },
  accentStrip: { width: '100%', height: 6, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -40,
  },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    overflow: 'hidden', backgroundColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#fff' },
  logoWrap: {
    width: 80, height: 80, borderRadius: 16,
    borderWidth: 4, borderColor: '#fff',
    overflow: 'hidden', backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  logoImg: { width: '100%', height: '100%' },
  logoText: { fontSize: 10, fontWeight: '700', textAlign: 'center', paddingHorizontal: 4 },
  logoFallback: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
    gap: 2,
    backgroundColor: '#F1F5F9',
  },
  logoFallbackText: {
    fontSize: 8, fontWeight: '700', color: '#fff',
    textAlign: 'center', paddingHorizontal: 2,
  },
  infoSection: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  companyLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: '#94A3B8', marginBottom: 1 },
  companyAccent: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  cardName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  jobTitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  companyText: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  deptText: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  bioSection: { paddingHorizontal: 20, paddingBottom: 8 },
  bioText: { fontSize: 13, color: '#64748B', lineHeight: 19 },
  contactsSection: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  contactIcon: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  contactTextWrap: { flex: 1 },
  contactValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  contactLabel: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  qrSection: {
    alignItems: 'center', paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  qrBox: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12 },
  qrLabel: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 24, paddingTop: 12, paddingHorizontal: 40,
    backgroundColor: 'rgba(243,244,246,0.95)',
  },
  shareBtn: {
    backgroundColor: BRAND,
    borderRadius: 28, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

/* ════════════════════════ Share modal styles ════════════════════════ */
const sh = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerBtn: { width: 36, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  qrWrap: { alignItems: 'center', marginBottom: 22, marginTop: 4 },
  qrBox: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  qrText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  group: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowIconWrap: {
    width: 32,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 16, fontWeight: '500', color: '#fff' },
  brandBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

/* ════════════════════════ Sub-screen styles ════════════════════════ */
const sub = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 6,
    paddingTop: 0,
  },
  codeInput: {
    color: '#fff',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 6,
    paddingTop: 0,
    width: 60,
    marginRight: 8,
  },
  contactsBtn: {
    alignItems: 'center',
    marginLeft: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 8,
    paddingHorizontal: 10,
  },
  contactsBtnText: { color: '#fff', fontSize: 10, fontWeight: '600', marginTop: 2 },
  sendBtn: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sendBtnText: { color: BRAND, fontWeight: '800', fontSize: 15 },
});

/* ════════════════════════ Sidebar styles ════════════════════════ */
const sd = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
    elevation: 12,
  },
  profileSection: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: 'flex-start',
  },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 14 },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 26, fontWeight: '800', color: '#fff' },
  name: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16, marginVertical: 8 },
  menu: { paddingHorizontal: 12, paddingTop: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  menuIcon: {
    width: 38, height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  signOutBtn: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
});
